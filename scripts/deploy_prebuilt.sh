#!/usr/bin/env bash
# ============================================================================
#  Ozoxx Experience — deploy_prebuilt.sh
#  Deploy rápido com frontend PRÉ-COMPILADO (GitHub Actions):
#   1. Recebe o tar.gz com os arquivos de build gerados no GitHub
#   2. Atualiza o código do backend via git pull
#   3. Atualiza dependências Python apenas se requirements.txt mudou
#   4. Extrai o build novo em pasta de release versionada
#   5. Swap atômico da pasta servida pelo nginx (zero-downtime)
#   6. Reload gracioso do gunicorn (SIGHUP) e reload do nginx
#  Uso: sudo bash deploy_prebuilt.sh [/caminho/para/frontend-build.tar.gz]
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ozoxx}"
APP_USER="${APP_USER:-ozoxx}"
BRANCH="${BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
LOG_FILE="${APP_DIR}/logs/update.log"
LOCK_FILE="/tmp/ozoxx-deploy.lock"
TAR_FILE="${1:-/tmp/frontend-build.tar.gz}"

# ---------- HELPERS ----------------------------------------------------------
ts()   { date '+%Y-%m-%d %H:%M:%S'; }
log()  { printf "\033[1;34m[deploy %s]\033[0m %s\n" "$(ts)" "$*" | tee -a "$LOG_FILE"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*" | tee -a "$LOG_FILE"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*" | tee -a "$LOG_FILE"; }
die()  { printf "\033[1;31m[deploy] %s\033[0m\n" "$*" >&2 | tee -a "$LOG_FILE"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Execute como root ou com sudo: sudo bash deploy_prebuilt.sh"
[ -f "$TAR_FILE" ] || die "Arquivo de build não encontrado: $TAR_FILE"

mkdir -p "$(dirname "$LOG_FILE")"

# ---------- LOCK (evita execuções simultâneas) -------------------------------
exec 9>"$LOCK_FILE"
flock -n 9 || die "Outro deploy já está em andamento (lock: $LOCK_FILE)."

START_TS="$(date +%s)"
cd "$APP_DIR" || die "Diretório $APP_DIR não existe."

# ---------- 1) ATUALIZAÇÃO DO REPOSITÓRIO (BACKEND/CÓDIGO) --------------------
log "Capturando versão atual do código..."
PREV_HASH="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')"
ok "Versão anterior: ${PREV_HASH:0:10}"

log "Sincronizando repositório (git fetch + reset --hard origin/$BRANCH)..."
sudo -u "$APP_USER" git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH" --quiet
NEW_HASH="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD)"
ok "Nova versão: ${NEW_HASH:0:10}"

# ---------- 2) DEPENDÊNCIAS DO BACKEND ---------------------------------------
if git -C "$APP_DIR" diff --name-only "$PREV_HASH" "$NEW_HASH" 2>/dev/null | grep -q '^backend/requirements\.txt$'; then
    log "requirements.txt foi alterado — atualizando venv Python..."
    EMERGENT_INDEX="https://d33sy5i8bnduwe.cloudfront.net/simple/"
    REQ_SRC="$APP_DIR/backend/requirements.txt"
    REQ_FILTERED="$APP_DIR/backend/requirements.filtered.txt"
    grep -viE '^(litellm[[:space:]]*[@=<>!~]|emergentintegrations[[:space:]]*[@=<>!~])' "$REQ_SRC" > "$REQ_FILTERED"
    chown "$APP_USER:$APP_USER" "$REQ_FILTERED"
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --extra-index-url "$EMERGENT_INDEX" emergentintegrations==0.2.0 >>"$LOG_FILE" 2>&1 || true
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --extra-index-url "$EMERGENT_INDEX" -r "$REQ_FILTERED" >>"$LOG_FILE" 2>&1
    ok "Dependências do backend atualizadas"
else
    ok "requirements.txt sem alterações — pulando pip install"
fi

# ---------- 3) APLICAÇÃO DO FRONTEND PRÉ-COMPILADO ---------------------------
RELEASE_TAG="$(date +%Y%m%d%H%M%S)-${NEW_HASH:0:7}"
NEW_BUILD_DIR="$APP_DIR/releases/$RELEASE_TAG"

log "Instalando release do frontend pré-compilado em: $NEW_BUILD_DIR..."
sudo -u "$APP_USER" mkdir -p "$NEW_BUILD_DIR"
sudo -u "$APP_USER" tar -xzf "$TAR_FILE" -C "$NEW_BUILD_DIR"
ok "Frontend extraído com sucesso"

# Remove o tar temporário para economizar espaço
rm -f "$TAR_FILE"

# ---------- 4) SWAP ATÔMICO DA PASTA SERVIDA PELO NGINX ----------------------
CURRENT_LINK="$APP_DIR/frontend/build"

# Backup do link/diretório anterior para segurança
PREV_BUILD=""
if [ -L "$CURRENT_LINK" ]; then
    PREV_BUILD="$(readlink -f "$CURRENT_LINK")"
elif [ -d "$CURRENT_LINK" ]; then
    BACKUP="$APP_DIR/releases/initial-$(date +%Y%m%d%H%M%S)"
    log "Migrando build estático inicial para releases/ → $BACKUP"
    sudo -u "$APP_USER" mv "$CURRENT_LINK" "$BACKUP"
    PREV_BUILD="$BACKUP"
fi

log "Realizando swap atômico: build → $NEW_BUILD_DIR"
sudo -u "$APP_USER" ln -sfn "$NEW_BUILD_DIR" "$CURRENT_LINK"
ok "Frontend ativo apontando para release: $RELEASE_TAG"

# Reload do Nginx
if systemctl list-unit-files | grep -q '^nginx\.service'; then
    nginx -t >>"$LOG_FILE" 2>&1
    systemctl reload nginx
    ok "Nginx recarregado com sucesso"
fi

# ---------- 5) RELOAD GRACIOSO DO BACKEND (SIGHUP) ---------------------------
log "Recarregando workers do backend..."
if systemctl reload ozoxx-backend 2>>"$LOG_FILE"; then
    for i in 1 2 3 4 5 6; do
        sleep 2
        if curl -fsS -m 5 "http://127.0.0.1:8001/api/public/config" >/dev/null 2>&1; then
            ok "Backend ativo e saudável após o reload"
            break
        fi
        [ "$i" = 6 ] && warn "Backend demorou a responder — verifique com: journalctl -u ozoxx-backend"
    done
else
    warn "systemctl reload falhou — executando restart..."
    systemctl restart ozoxx-backend
fi

# ---------- 6) ROLLBACK EM CASO DE FALHA NO BACKEND --------------------------
if ! systemctl is-active --quiet ozoxx-backend; then
    warn "Backend inativo — executando rollback..."
    if [ -n "$PREV_BUILD" ] && [ -d "$PREV_BUILD" ]; then
        sudo -u "$APP_USER" ln -sfn "$PREV_BUILD" "$CURRENT_LINK"
        systemctl reload nginx 2>/dev/null || true
    fi
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "$PREV_HASH" --quiet
    systemctl restart ozoxx-backend
    die "Rollback concluído para $PREV_HASH devido a erro no backend."
fi

# ---------- 7) LIMPEZA DE RELEASES ANTIGAS -----------------------------------
log "Limpando releases antigas (mantendo as últimas $KEEP_RELEASES)..."
cd "$APP_DIR/releases"
ls -1t | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
    [ -n "$old" ] && rm -rf "$old" && ok "Release antiga removida: $old"
done
cd "$APP_DIR"

# ---------- SUCESSO ----------------------------------------------------------
ELAPSED=$(( $(date +%s) - START_TS ))
ok "Deploy finalizado em ${ELAPSED} segundos!"
log "Log completo em: $LOG_FILE"

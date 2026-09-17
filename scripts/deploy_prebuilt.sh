#!/usr/bin/env bash
# ============================================================================
#  Ozoxx Experience — deploy_prebuilt.sh
#  Deploy rápido com artefatos PRÉ-COMPILADOS (GitHub Actions):
#   1. Recebe a pasta extraída com: frontend_build/, backend/, scripts/
#   2. Instala o frontend compilado em uma pasta de release versionada
#   3. Realiza swap atômico do symlink (Zero Downtime no frontend)
#   4. Atualiza o código do backend preservando .env e pasta uploads
#   5. Atualiza dependências Python no venv
#   6. Recarrega Nginx e Gunicorn (SIGHUP) de forma graciosa
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ozoxx}"
APP_USER="${APP_USER:-ozoxx}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
LOG_FILE="${APP_DIR}/logs/update.log"
LOCK_FILE="/tmp/ozoxx-deploy.lock"
SOURCE_DIR="${1:-/tmp/ozoxx-deploy}"

# ---------- HELPERS ----------------------------------------------------------
ts()   { date '+%Y-%m-%d %H:%M:%S'; }
log()  { printf "\033[1;34m[deploy %s]\033[0m %s\n" "$(ts)" "$*" | tee -a "$LOG_FILE"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*" | tee -a "$LOG_FILE"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*" | tee -a "$LOG_FILE"; }
die()  { printf "\033[1;31m[deploy] %s\033[0m\n" "$*" >&2 | tee -a "$LOG_FILE"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Execute como root ou com sudo: sudo bash deploy_prebuilt.sh"
[ -d "$SOURCE_DIR" ] || die "Diretório de origem não encontrado: $SOURCE_DIR"

mkdir -p "$(dirname "$LOG_FILE")"

# ---------- LOCK (evita concorrência) ----------------------------------------
exec 9>"$LOCK_FILE"
flock -n 9 || die "Outro deploy já está em andamento (lock: $LOCK_FILE)."

START_TS="$(date +%s)"
cd "$APP_DIR" || die "Diretório $APP_DIR não existe."

# ---------- 1) FRONTEND PRÉ-COMPILADO EM PASTA DE RELEASE --------------------
RELEASE_TAG="$(date +%Y%m%d%H%M%S)"
NEW_BUILD_DIR="$APP_DIR/releases/$RELEASE_TAG"

if [ -d "$SOURCE_DIR/frontend_build" ]; then
    log "Instalando release do frontend em: $NEW_BUILD_DIR..."
    mkdir -p "$NEW_BUILD_DIR"
    cp -r "$SOURCE_DIR/frontend_build/"* "$NEW_BUILD_DIR/"
    chown -R "$APP_USER:$APP_USER" "$NEW_BUILD_DIR"
    ok "Arquivos estáticos instalados"

    # Swap atômico da pasta do frontend
    CURRENT_LINK="$APP_DIR/frontend/build"
    PREV_BUILD=""
    if [ -L "$CURRENT_LINK" ]; then
        PREV_BUILD="$(readlink -f "$CURRENT_LINK")"
    elif [ -d "$CURRENT_LINK" ]; then
        BACKUP="$APP_DIR/releases/initial-$(date +%Y%m%d%H%M%S)"
        log "Migrando build estático inicial → $BACKUP"
        mv "$CURRENT_LINK" "$BACKUP"
        PREV_BUILD="$BACKUP"
    fi

    log "Realizando swap atômico do frontend: build → $NEW_BUILD_DIR"
    ln -sfn "$NEW_BUILD_DIR" "$CURRENT_LINK"
    chown -h "$APP_USER:$APP_USER" "$CURRENT_LINK"
    ok "Frontend apontando para release: $RELEASE_TAG"
fi

# ---------- 2) ATUALIZAÇÃO DO CÓDIGO BACKEND ---------------------------------
if [ -d "$SOURCE_DIR/backend" ]; then
    log "Sincronizando arquivos do backend (preservando .env e uploads/)..."
    mkdir -p "$APP_DIR/backend"
    
    # Salva hash anterior do requirements.txt para saber se precisa de pip install
    PREV_REQ_HASH=""
    [ -f "$APP_DIR/backend/requirements.txt" ] && PREV_REQ_HASH="$(md5sum "$APP_DIR/backend/requirements.txt" | cut -d' ' -f1)"

    if command -v rsync >/dev/null 2>&1; then
        rsync -a --exclude='.env' --exclude='uploads' --exclude='__pycache__' \
            "$SOURCE_DIR/backend/" "$APP_DIR/backend/"
    else
        # Fallback caso não tenha rsync
        cp -r "$SOURCE_DIR/backend/"* "$APP_DIR/backend/" 2>/dev/null || true
    fi

    chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend"

    # Atualiza dependências do backend se requirements.txt foi alterado
    NEW_REQ_HASH=""
    [ -f "$APP_DIR/backend/requirements.txt" ] && NEW_REQ_HASH="$(md5sum "$APP_DIR/backend/requirements.txt" | cut -d' ' -f1)"

    if [ "$PREV_REQ_HASH" != "$NEW_REQ_HASH" ] && [ -d "$APP_DIR/venv" ]; then
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
        ok "Dependências do backend sem alterações"
    fi
fi

# ---------- 3) ATUALIZAÇÃO DOS SCRIPTS ---------------------------------------
if [ -d "$SOURCE_DIR/scripts" ]; then
    mkdir -p "$APP_DIR/scripts"
    cp -r "$SOURCE_DIR/scripts/"* "$APP_DIR/scripts/" 2>/dev/null || true
    chmod +x "$APP_DIR/scripts/"*.sh 2>/dev/null || true
    chown -R "$APP_USER:$APP_USER" "$APP_DIR/scripts"
fi

# ---------- 4) LIMPEZA DO DIRETÓRIO TEMPORÁRIO -------------------------------
rm -rf "$SOURCE_DIR"

# ---------- 5) RELOAD DO NGINX -----------------------------------------------
if systemctl list-unit-files | grep -q '^nginx\.service'; then
    nginx -t >>"$LOG_FILE" 2>&1
    systemctl reload nginx
    ok "Nginx recarregado com sucesso"
fi

# ---------- 6) RELOAD GRACIOSO DO BACKEND (SIGHUP) ---------------------------
if systemctl list-unit-files | grep -q '^ozoxx-backend\.service'; then
    log "Recarregando workers do backend..."
    if systemctl reload ozoxx-backend 2>>"$LOG_FILE"; then
        for i in 1 2 3 4 5 6; do
            sleep 2
            if curl -fsS -m 5 "http://127.0.0.1:8001/api/public/config" >/dev/null 2>&1; then
                ok "Backend ativo e respondendo"
                break
            fi
            [ "$i" = 6 ] && warn "Backend demorou a responder — verifique: journalctl -u ozoxx-backend"
        done
    else
        warn "systemctl reload falhou — tentando restart..."
        systemctl restart ozoxx-backend
    fi
fi

# ---------- 7) LIMPEZA DE RELEASES ANTIGAS -----------------------------------
if [ -d "$APP_DIR/releases" ]; then
    log "Limpando releases antigas (mantendo as últimas $KEEP_RELEASES)..."
    cd "$APP_DIR/releases"
    ls -1t | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
        [ -n "$old" ] && rm -rf "$old" && ok "Release antiga removida: $old"
    done
    cd "$APP_DIR"
fi

# ---------- CONCLUÍDO --------------------------------------------------------
ELAPSED=$(( $(date +%s) - START_TS ))
ok "Deploy finalizado em ${ELAPSED} segundos com Zero Downtime!"
log "Log completo em: $LOG_FILE"

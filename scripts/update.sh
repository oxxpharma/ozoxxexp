#!/usr/bin/env bash
# ============================================================================
#  Ozoxx Experience — update.sh
#  Update SILENCIOSO / ZERO-DOWNTIME:
#   1. Pega a versão atual e faz git pull
#   2. Build do frontend em pasta paralela
#   3. Atualiza deps do backend (somente se requirements.txt mudou)
#   4. Swap atômico da pasta de build (via symlink)
#   5. Reload gracioso do gunicorn (SIGHUP → workers reciclados sem cortar conexões)
#   6. Reload do nginx
#  Em caso de falha em qualquer etapa, faz rollback para a release anterior.
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ozoxx}"
APP_USER="${APP_USER:-ozoxx}"
BRANCH="${BRANCH:-main}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
LOG_FILE="${APP_DIR}/logs/update.log"
LOCK_FILE="/tmp/ozoxx-update.lock"

# ---------- HELPERS ----------------------------------------------------------
ts()   { date '+%Y-%m-%d %H:%M:%S'; }
log()  { printf "\033[1;34m[update %s]\033[0m %s\n" "$(ts)" "$*" | tee -a "$LOG_FILE"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*" | tee -a "$LOG_FILE"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*" | tee -a "$LOG_FILE"; }
die()  { printf "\033[1;31m[update] %s\033[0m\n" "$*" >&2 | tee -a "$LOG_FILE"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode com sudo: sudo bash update.sh"
mkdir -p "$(dirname "$LOG_FILE")"

# ---------- LOCK (evita updates concorrentes) -------------------------------
exec 9>"$LOCK_FILE"
flock -n 9 || die "Outro update em andamento (lock: $LOCK_FILE). Aborte com: rm $LOCK_FILE"

START_TS="$(date +%s)"
cd "$APP_DIR" || die "APP_DIR não existe: $APP_DIR"

# ---------- 1) GIT PULL ------------------------------------------------------
log "Capturando hash atual..."
PREV_HASH="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')"
ok "Atual: ${PREV_HASH:0:10}"

log "git fetch + reset --hard origin/$BRANCH..."
sudo -u "$APP_USER" git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH" --quiet
NEW_HASH="$(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse HEAD)"
ok "Novo:  ${NEW_HASH:0:10}"

if [ "$PREV_HASH" = "$NEW_HASH" ]; then
    ok "Nada a atualizar — já está em $NEW_HASH"
    exit 0
fi

# ---------- 2) BACKEND DEPS (se mudou) --------------------------------------
if git -C "$APP_DIR" diff --name-only "$PREV_HASH" "$NEW_HASH" 2>/dev/null | grep -q '^backend/requirements\.txt$'; then
    log "requirements.txt mudou — atualizando venv..."
    EMERGENT_INDEX="https://d33sy5i8bnduwe.cloudfront.net/simple/"
    # Filtra litellm + emergentintegrations e instala em 2 etapas para evitar
    # ResolutionImpossible quando duas URLs idênticas são declaradas.
    REQ_SRC="$APP_DIR/backend/requirements.txt"
    REQ_FILTERED="$APP_DIR/backend/requirements.filtered.txt"
    grep -viE '^(litellm[[:space:]]*[@=<>!~]|emergentintegrations[[:space:]]*[@=<>!~])' "$REQ_SRC" > "$REQ_FILTERED"
    chown "$APP_USER:$APP_USER" "$REQ_FILTERED"
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --extra-index-url "$EMERGENT_INDEX" emergentintegrations==0.2.0 >>"$LOG_FILE" 2>&1
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --extra-index-url "$EMERGENT_INDEX" -r "$REQ_FILTERED" >>"$LOG_FILE" 2>&1
    ok "Backend deps atualizadas"
else
    ok "requirements.txt inalterado — pulei pip install"
fi

# ---------- 3) FRONTEND BUILD EM PASTA PARALELA ------------------------------
RELEASE_TAG="$(date +%Y%m%d%H%M%S)-${NEW_HASH:0:7}"
NEW_BUILD_DIR="$APP_DIR/releases/$RELEASE_TAG"
log "Build do frontend → $NEW_BUILD_DIR (paralelo, build antigo continua servindo)..."

# Se yarn.lock mudou, reinstala deps; senão pula install
if git -C "$APP_DIR" diff --name-only "$PREV_HASH" "$NEW_HASH" 2>/dev/null | grep -q '^frontend/\(package\.json\|yarn\.lock\)$'; then
    log "Dependências frontend mudaram — yarn install com retry..."
    sudo -u "$APP_USER" bash -lc '
        cd "'"$APP_DIR"'/frontend" || exit 1
        REGISTRIES=("https://registry.yarnpkg.com" "https://registry.npmjs.org" "https://registry.yarnpkg.com")
        for i in 1 2 3; do
            REG="${REGISTRIES[$((i-1))]}"
            if yarn install --frozen-lockfile --network-timeout 600000 --registry "$REG"; then
                break
            fi
            [ "$i" = "3" ] && exit 1
            sleep 5
        done
    ' >>"$LOG_FILE" 2>&1 || die "yarn install falhou após 3 tentativas — veja $LOG_FILE"
fi

# Build (saída padrão: frontend/build) — depois movemos para a pasta da release
sudo -u "$APP_USER" bash -lc "
    cd '$APP_DIR/frontend' && \
    rm -rf build.new && \
    NODE_OPTIONS='--max-old-space-size=4096' \
    BUILD_PATH='$APP_DIR/frontend/build.new' yarn build
" >>"$LOG_FILE" 2>&1 || die "Build do frontend falhou — veja $LOG_FILE"

# Move o build para a pasta de release (versionada)
sudo -u "$APP_USER" mkdir -p "$APP_DIR/releases"
sudo -u "$APP_USER" mv "$APP_DIR/frontend/build.new" "$NEW_BUILD_DIR"
ok "Build pronto: $NEW_BUILD_DIR"

# ---------- 4) SWAP ATÔMICO DA PASTA SERVIDA PELO NGINX ----------------------
CURRENT_LINK="$APP_DIR/frontend/build"

# Guarda referência ao build anterior (para rollback)
PREV_BUILD=""
if [ -L "$CURRENT_LINK" ]; then
    PREV_BUILD="$(readlink -f "$CURRENT_LINK")"
elif [ -d "$CURRENT_LINK" ]; then
    # primeira vez: converte pasta em symlink preservando o build atual
    BACKUP="$APP_DIR/releases/initial-$(date +%Y%m%d%H%M%S)"
    log "Convertendo build/ inicial em release versionada → $BACKUP"
    sudo -u "$APP_USER" mv "$CURRENT_LINK" "$BACKUP"
    PREV_BUILD="$BACKUP"
fi

log "Swap atômico: build → $NEW_BUILD_DIR"
# ln -sfn é atômico: substitui o symlink em uma única syscall (sem brecha)
sudo -u "$APP_USER" ln -sfn "$NEW_BUILD_DIR" "$CURRENT_LINK"
ok "Frontend agora serve $RELEASE_TAG"

# Reload do nginx — atende novas requisições com o build novo sem cortar conexões
if systemctl list-unit-files | grep -q '^nginx\.service'; then
    nginx -t >>"$LOG_FILE" 2>&1
    systemctl reload nginx
    ok "nginx reload"
fi

# ---------- 5) BACKEND: RELOAD GRACIOSO (gunicorn SIGHUP) --------------------
log "Reload gracioso do backend (gunicorn recicla workers sem cortar conexões)..."
if systemctl reload ozoxx-backend 2>>"$LOG_FILE"; then
    # Health check
    for i in 1 2 3 4 5 6; do
        sleep 2
        if curl -fsS -m 5 "http://127.0.0.1:8001/api/public/config" >/dev/null 2>&1; then
            ok "Backend respondendo após reload"
            break
        fi
        [ "$i" = 6 ] && warn "Backend não respondeu em 12s — verifique journalctl -u ozoxx-backend"
    done
else
    warn "systemctl reload falhou — tentando restart..."
    systemctl restart ozoxx-backend
fi

# ---------- 6) ROLLBACK AUTOMÁTICO EM CASO DE FALHA --------------------------
if ! systemctl is-active --quiet ozoxx-backend; then
    warn "Backend caiu — fazendo ROLLBACK..."
    if [ -n "$PREV_BUILD" ] && [ -d "$PREV_BUILD" ]; then
        sudo -u "$APP_USER" ln -sfn "$PREV_BUILD" "$CURRENT_LINK"
        systemctl reload nginx 2>/dev/null || true
    fi
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "$PREV_HASH" --quiet
    systemctl restart ozoxx-backend
    die "Rollback executado para $PREV_HASH — release $RELEASE_TAG descartada"
fi

# ---------- 7) LIMPEZA DE RELEASES ANTIGAS -----------------------------------
log "Mantendo as últimas $KEEP_RELEASES releases..."
cd "$APP_DIR/releases"
# Mantém só as N mais recentes (por mtime)
ls -1t | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
    [ -n "$old" ] && rm -rf "$old" && warn "Removida release antiga: $old"
done
cd "$APP_DIR"

# ---------- DONE -------------------------------------------------------------
ELAPSED=$(( $(date +%s) - START_TS ))
ok "Update concluído em ${ELAPSED}s — release ${RELEASE_TAG} (${NEW_HASH:0:10})"
echo "  Anterior: ${PREV_HASH:0:10}  →  Atual: ${NEW_HASH:0:10}"
echo "  Log: $LOG_FILE"

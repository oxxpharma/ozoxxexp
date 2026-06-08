#!/usr/bin/env bash
# ============================================================================
#  Ozoxx Experience — install.sh
#  Instala todas as dependências e configura o ambiente para produção.
#  Compatível com Ubuntu 22.04+ / Debian 12+. Rodar como root (sudo).
# ============================================================================
set -euo pipefail

# ---------- CONFIG -----------------------------------------------------------
# Auto-detecta APP_DIR: se rodado de dentro de um projeto (tem backend/ e frontend/),
# usa essa pasta. Caso contrário, default = /opt/ozoxx.
_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_AUTO_APP_DIR="$(cd "$_SCRIPT_DIR/.." 2>/dev/null && pwd || echo "")"
if [ -d "$_AUTO_APP_DIR/backend" ] && [ -d "$_AUTO_APP_DIR/frontend" ]; then
    APP_DIR="${APP_DIR:-$_AUTO_APP_DIR}"
else
    APP_DIR="${APP_DIR:-/opt/ozoxx}"
fi
APP_USER="${APP_USER:-ozoxx}"
NODE_VERSION="${NODE_VERSION:-20}"
PYTHON_VERSION="${PYTHON_VERSION:-3.11}"
PYTHON_BIN="${PYTHON_BIN:-python${PYTHON_VERSION}}"
INSTALL_MONGO="${INSTALL_MONGO:-yes}"        # yes|no — set "no" se for usar Atlas/remoto
INSTALL_NGINX="${INSTALL_NGINX:-yes}"        # yes|no
DOMAIN="${DOMAIN:-}"                          # ex: ozoxx.com (opcional, só p/ nginx)

# ---------- HELPERS ----------------------------------------------------------
log()  { printf "\033[1;34m[install]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m[install] %s\033[0m\n" "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode com sudo: sudo bash install.sh"

# ---------- BASE PACKAGES ----------------------------------------------------
log "Atualizando índice apt e instalando pacotes base..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
    curl ca-certificates gnupg lsb-release software-properties-common \
    git build-essential pkg-config \
    supervisor jq rsync ufw
ok "Pacotes base instalados"

# ---------- PYTHON ${PYTHON_VERSION} ----------------------------------------
if ! command -v "$PYTHON_BIN" >/dev/null; then
    log "Python $PYTHON_VERSION não encontrado — instalando via deadsnakes PPA..."
    # deadsnakes só existe oficialmente para Ubuntu. Em Debian, instalamos do source.
    if [ -f /etc/os-release ] && grep -qi ubuntu /etc/os-release; then
        add-apt-repository -y ppa:deadsnakes/ppa
        apt-get update -y
        apt-get install -y "python${PYTHON_VERSION}" "python${PYTHON_VERSION}-venv" "python${PYTHON_VERSION}-dev"
    else
        warn "Debian detectado — tentando 'python3.11' do repositório oficial"
        apt-get install -y "python${PYTHON_VERSION}" "python${PYTHON_VERSION}-venv" "python${PYTHON_VERSION}-dev" || \
            die "Instale manualmente Python $PYTHON_VERSION e rode novamente"
    fi
fi
ok "$($PYTHON_BIN --version)"

# ---------- NODE.JS + YARN ---------------------------------------------------
if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null | sed 's/v//;s/\..*//')" -lt "$NODE_VERSION" ]]; then
    log "Instalando Node.js ${NODE_VERSION}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt-get install -y nodejs
fi
ok "Node $(node -v) / npm $(npm -v)"

if ! command -v yarn >/dev/null; then
    log "Instalando yarn..."
    npm install -g yarn
fi
ok "Yarn $(yarn -v)"

# ---------- MONGODB ----------------------------------------------------------
if [ "$INSTALL_MONGO" = "yes" ]; then
    if ! command -v mongod >/dev/null; then
        log "Instalando MongoDB 7.0..."
        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
        CODENAME="$(lsb_release -sc || echo jammy)"
        echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" \
            > /etc/apt/sources.list.d/mongodb-org-7.0.list
        apt-get update -y
        apt-get install -y mongodb-org
        systemctl enable --now mongod
    fi
    ok "MongoDB ativo: $(systemctl is-active mongod)"
else
    warn "INSTALL_MONGO=no — pulando MongoDB local (use MONGO_URL remoto no .env)"
fi

# ---------- NGINX ------------------------------------------------------------
if [ "$INSTALL_NGINX" = "yes" ]; then
    if ! command -v nginx >/dev/null; then
        log "Instalando nginx..."
        apt-get install -y nginx
    fi
    # Plugin do certbot para nginx (Let's Encrypt — emissão e renovação automáticas)
    apt-get install -y certbot python3-certbot-nginx
    ok "Nginx + certbot instalados"
fi

# ---------- USUÁRIO DA APLICAÇÃO --------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
    log "Criando usuário do sistema: $APP_USER"
    useradd -r -m -d "$APP_DIR" -s /bin/bash "$APP_USER"
fi
ok "Usuário $APP_USER ok"

# ---------- DIRETÓRIOS -------------------------------------------------------
log "Preparando diretório da aplicação em $APP_DIR..."
mkdir -p "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/logs" "$APP_DIR/uploads"
# Se este script for executado de FORA do APP_DIR e o projeto estiver em outro lugar,
# copia tudo para o APP_DIR. Caso contrário (já estamos dentro), apenas reutiliza.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ "$PROJECT_ROOT" != "$APP_DIR" ] && [ -d "$PROJECT_ROOT/backend" ] && [ -d "$PROJECT_ROOT/frontend" ]; then
    log "Copiando código de $PROJECT_ROOT → $APP_DIR ..."
    rsync -a --delete \
        --exclude .git --exclude node_modules --exclude venv --exclude __pycache__ \
        --exclude "frontend/build" --exclude ".env" \
        "$PROJECT_ROOT/" "$APP_DIR/"
else
    log "Aplicação já está em $APP_DIR — reutilizando"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "Código em $APP_DIR"

# ---------- BACKEND: VENV + DEPS --------------------------------------------
log "Criando virtualenv do backend..."
# emergentintegrations vive num index privado da Emergent
EMERGENT_INDEX="https://d33sy5i8bnduwe.cloudfront.net/simple/"

sudo -u "$APP_USER" bash -lc "
    cd '$APP_DIR' && \
    $PYTHON_BIN -m venv venv && \
    ./venv/bin/pip install --upgrade pip wheel
"

# emergentintegrations declara 'litellm @ URL' como dependência. Se o requirements.txt
# também declarar 'litellm @ URL' (mesmo idêntico), o pip 24+ recusa unificar dois
# requisitos diretos por URL → ResolutionImpossible.
# Solução robusta: gera um requirements_no_litellm.txt sem essa linha e
# instala 'emergentintegrations' (que traz litellm correto) separadamente.
REQ_SRC="$APP_DIR/backend/requirements.txt"
REQ_FILTERED="$APP_DIR/backend/requirements.filtered.txt"
grep -viE '^(litellm[[:space:]]*[@=<>!~]|emergentintegrations[[:space:]]*[@=<>!~])' "$REQ_SRC" > "$REQ_FILTERED"
chown "$APP_USER:$APP_USER" "$REQ_FILTERED"
log "Instalando emergentintegrations (traz litellm transitivamente)..."
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --extra-index-url "$EMERGENT_INDEX" emergentintegrations==0.2.0
log "Instalando demais dependências do backend..."
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --extra-index-url "$EMERGENT_INDEX" -r "$REQ_FILTERED"
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install 'gunicorn>=21.0'
ok "Backend Python deps instaladas"

# ---------- SWAP (se RAM baixa) ---------------------------------------------
# Build do React (webpack) consome 1-2 GB de heap. Em VPSs pequenos (<= 2 GB RAM)
# isso causa "JavaScript heap out of memory". Criamos 4 GB de swap se necessário.
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3000 ] && [ "$SWAP_MB" -lt 2000 ] && [ ! -f /swapfile ]; then
    log "RAM=${MEM_MB}MB / Swap=${SWAP_MB}MB — criando 4GB de swap (/swapfile)..."
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q "^/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
    ok "Swap ativo: $(swapon --show=NAME,SIZE --noheadings | head -1)"
else
    ok "RAM=${MEM_MB}MB / Swap=${SWAP_MB}MB — suficiente"
fi

# ---------- FRONTEND: DEPS + BUILD ------------------------------------------
log "Instalando deps + build do frontend..."
# Yarn não retenta após ESOCKETTIMEDOUT por default. Aumentamos o timeout
# para 10min e fazemos até 3 tentativas, alternando para o registry do npm
# se a 2ª falhar (registry.yarnpkg.com às vezes fica lento).
sudo -u "$APP_USER" bash -lc '
    cd "'"$APP_DIR"'/frontend" || exit 1
    NETWORK_TIMEOUT=600000   # 10 minutos
    REGISTRIES=("https://registry.yarnpkg.com" "https://registry.npmjs.org" "https://registry.yarnpkg.com")
    for i in 1 2 3; do
        REG="${REGISTRIES[$((i-1))]}"
        echo "[yarn] Tentativa $i/3 — registry: $REG"
        if yarn install --frozen-lockfile \
              --network-timeout $NETWORK_TIMEOUT \
              --registry "$REG"; then
            echo "[yarn] Sucesso na tentativa $i"
            break
        fi
        if [ "$i" = "3" ]; then
            echo "[yarn] Falhou após 3 tentativas — verifique conexão"
            exit 1
        fi
        echo "[yarn] Falhou — aguardando 5s e tentando novamente..."
        sleep 5
    done
    # Build com heap aumentado (4GB) — evita "JavaScript heap out of memory"
    NODE_OPTIONS="--max-old-space-size=4096" yarn build
'
ok "Frontend build em $APP_DIR/frontend/build"

# ---------- ARQUIVOS DE AMBIENTE (TEMPLATES) --------------------------------
if [ ! -f "$APP_DIR/backend/.env" ]; then
    cat > "$APP_DIR/backend/.env" <<EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ozoxx_database"
CORS_ORIGINS="*"
JWT_SECRET="$(openssl rand -hex 32)"
APP_NAME="ozoxx"
ENABLE_DEV_SIMULATE_PAY="false"
PUBLIC_BASE_URL="${DOMAIN:+https://$DOMAIN}"
STORAGE_BACKEND="local"
LOCAL_STORAGE_DIR="$APP_DIR/uploads"
EOF
    chown "$APP_USER:$APP_USER" "$APP_DIR/backend/.env"
    warn "backend/.env criado com JWT_SECRET aleatório. Revise as variáveis."
fi

if [ ! -f "$APP_DIR/frontend/.env" ]; then
    cat > "$APP_DIR/frontend/.env" <<EOF
REACT_APP_BACKEND_URL="${DOMAIN:+https://$DOMAIN}"
EOF
    chown "$APP_USER:$APP_USER" "$APP_DIR/frontend/.env"
    warn "frontend/.env criado. Ajuste REACT_APP_BACKEND_URL e rode o build novamente."
fi

# ---------- SYSTEMD: BACKEND -------------------------------------------------
log "Configurando service systemd: ozoxx-backend..."
cat > /etc/systemd/system/ozoxx-backend.service <<EOF
[Unit]
Description=Ozoxx Backend (FastAPI via gunicorn+uvicorn)
After=network.target mongod.service

[Service]
Type=notify
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/venv/bin/gunicorn server:app \\
    --worker-class uvicorn.workers.UvicornWorker \\
    --workers 4 \\
    --bind 127.0.0.1:8001 \\
    --timeout 90 \\
    --graceful-timeout 30 \\
    --access-logfile $APP_DIR/logs/backend-access.log \\
    --error-logfile  $APP_DIR/logs/backend-error.log \\
    --pid $APP_DIR/logs/backend.pid
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
ok "ozoxx-backend.service"

# ---------- NGINX: SITE ------------------------------------------------------
if [ "$INSTALL_NGINX" = "yes" ]; then
    SERVER_NAME="${DOMAIN:-_}"
    log "Configurando nginx para $SERVER_NAME..."
    cat > /etc/nginx/sites-available/ozoxx <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    client_max_body_size 50M;
    root $APP_DIR/frontend/build;
    index index.html;

    # API → backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }

    # Hashed assets — cache longo
    location /static/ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/ozoxx /etc/nginx/sites-enabled/ozoxx
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    ok "nginx reload"
fi

# ---------- FIREWALL ---------------------------------------------------------
if command -v ufw >/dev/null; then
    ufw allow OpenSSH || true
    ufw allow 'Nginx Full' || true
fi

# ---------- ATIVAR + START ---------------------------------------------------
systemctl daemon-reload
systemctl enable --now ozoxx-backend
ok "Backend systemd ativo"

# ---------- WRAPPERS ---------------------------------------------------------
log "Instalando wrappers em /usr/local/bin..."
for s in start restart update; do
    install -m 0755 "$APP_DIR/scripts/${s}.sh" "/usr/local/bin/ozoxx-${s}" || warn "scripts/${s}.sh não encontrado"
done

echo
ok "Instalação concluída."
echo "  • Backend:   systemctl status ozoxx-backend"
echo "  • Frontend:  servido pelo nginx em ${DOMAIN:-http://<server-ip>}"
echo "  • Logs:      $APP_DIR/logs/"
echo "  • Comandos:  ozoxx-start | ozoxx-restart | ozoxx-update"
[ -n "${DOMAIN}" ] && echo "  • TLS:       sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN"

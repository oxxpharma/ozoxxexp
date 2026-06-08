#!/usr/bin/env bash
# ============================================================================
#  Ozoxx Experience — start.sh
#  Inicia backend (gunicorn via systemd) e garante que o nginx está rodando.
# ============================================================================
set -euo pipefail

log()  { printf "\033[1;34m[start]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m[start] %s\033[0m\n" "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode com sudo: sudo bash start.sh"

log "Iniciando backend..."
systemctl start ozoxx-backend
systemctl is-active --quiet ozoxx-backend || die "ozoxx-backend não subiu — veja: journalctl -u ozoxx-backend -n 100"
ok "Backend: $(systemctl is-active ozoxx-backend)"

if systemctl list-unit-files | grep -q '^nginx\.service'; then
    log "Iniciando nginx..."
    systemctl start nginx
    ok "Nginx: $(systemctl is-active nginx)"
fi

if systemctl list-unit-files | grep -q '^mongod\.service'; then
    if ! systemctl is-active --quiet mongod; then
        log "Iniciando mongod..."
        systemctl start mongod
    fi
    ok "MongoDB: $(systemctl is-active mongod)"
fi

ok "Tudo rodando."

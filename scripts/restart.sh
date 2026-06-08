#!/usr/bin/env bash
# ============================================================================
#  Ozoxx Experience — restart.sh
#  Reinicia backend e nginx de forma graciosa (sem derrubar conexões ativas).
# ============================================================================
set -euo pipefail

log()  { printf "\033[1;34m[restart]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
die()  { printf "\033[1;31m[restart] %s\033[0m\n" "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Rode com sudo: sudo bash restart.sh"

MODE="${1:-graceful}"   # graceful | hard

if [ "$MODE" = "hard" ]; then
    log "Restart HARD do backend (corta workers)..."
    systemctl restart ozoxx-backend
else
    log "Reload GRACIOSO do backend (workers reciclados sem downtime)..."
    # gunicorn responde a SIGHUP recarregando workers um a um
    systemctl reload ozoxx-backend
fi
systemctl is-active --quiet ozoxx-backend || die "backend não está ativo"
ok "Backend: $(systemctl is-active ozoxx-backend)"

if systemctl list-unit-files | grep -q '^nginx\.service'; then
    log "Reload do nginx..."
    nginx -t
    systemctl reload nginx
    ok "Nginx: $(systemctl is-active nginx)"
fi

ok "Restart concluído (modo: $MODE)."

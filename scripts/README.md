# Deploy em produção — Ozoxx Experience

Scripts para subir e manter o sistema em um servidor próprio (Ubuntu 22.04+ / Debian 12+).

## Visão geral

| Script | Função | Downtime |
|--------|--------|----------|
| `install.sh` | Instalação inicial completa (Python, Node, MongoDB, nginx, systemd, build) | N/A (primeira vez) |
| `start.sh` | Inicia backend + nginx + mongod | — |
| `restart.sh [graceful\|hard]` | Reload do backend (default: graceful via SIGHUP) + reload do nginx | **zero** no modo graceful |
| `update.sh` | Pull do git, build paralelo, swap atômico, reload gracioso, rollback automático em falha | **zero** |

## Pré-requisitos

- Servidor com Ubuntu 22.04+ ou Debian 12+
- Acesso root (sudo)
- Repositório do projeto clonado em `/opt/ozoxx` (ou onde quiser via `APP_DIR=...`)
- Domínio apontando para o IP do servidor (opcional, recomendado)

## 1) Primeira instalação

```bash
git clone https://github.com/SEU_USUARIO/ozoxx.git /opt/ozoxx
cd /opt/ozoxx
sudo DOMAIN=ozoxx.com bash scripts/install.sh
```

Variáveis úteis:

| Var | Default | O que faz |
|-----|---------|-----------|
| `APP_DIR` | `/opt/ozoxx` | Onde a aplicação vai morar |
| `APP_USER` | `ozoxx` | Usuário do sistema dono dos arquivos |
| `DOMAIN` | (vazio) | Configura o `server_name` do nginx e o `PUBLIC_BASE_URL` |
| `INSTALL_MONGO` | `yes` | Use `no` se for usar MongoDB Atlas/remoto |
| `INSTALL_NGINX` | `yes` | Use `no` se já tem proxy reverso próprio |
| `NODE_VERSION` | `20` | Versão do Node.js |

Depois rode (uma vez): `sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d seu-dominio.com` para HTTPS automático.

## 2) Operação no dia a dia

```bash
sudo ozoxx-start      # iniciar tudo (caso o servidor reinicie etc.)
sudo ozoxx-restart    # reload gracioso (zero-downtime)
sudo ozoxx-update     # pull do git + rebuild + reload silencioso
```

Os 3 comandos acima são wrappers instalados em `/usr/local/bin` pelo `install.sh`.

## 3) Como o zero-downtime funciona

**Frontend** (atomic build swap):
1. Build novo é feito em `releases/YYYYMMDDHHMMSS-<hash>/` enquanto o nginx ainda serve o build antigo.
2. Quando termina, `ln -sfn` substitui o symlink `frontend/build` em uma única syscall.
3. Próximas requisições do nginx pegam o build novo imediatamente, requests em voo terminam com o antigo. Resultado: **sem 5xx e sem flash de tela branca**.

**Backend** (gunicorn graceful reload):
1. `systemctl reload ozoxx-backend` envia `SIGHUP` ao master do gunicorn.
2. O master inicia novos workers com o código novo.
3. Quando os novos estão prontos, ele encerra os workers antigos depois que eles terminam as requisições em andamento (`graceful_timeout=30s`).
4. Conexões abertas (WebSocket, uploads longos) não são cortadas.

**Rollback automático**:
- Se o backend não responder ao health-check pós-reload, o `update.sh`:
  - Restaura o symlink para o build anterior.
  - `git reset --hard` para o commit anterior.
  - Reinicia o backend.
- Você só perde a release problemática, sem precisar intervir.

## 4) Logs

- Backend: `journalctl -u ozoxx-backend -f` ou `/opt/ozoxx/logs/backend-{access,error}.log`
- Updates: `/opt/ozoxx/logs/update.log`
- Nginx: `/var/log/nginx/{access,error}.log`

## 5) Estrutura de pastas pós-instalação

```
/opt/ozoxx/
├── backend/                # código FastAPI
├── frontend/
│   ├── src/                # código React
│   └── build → ../releases/20260608123045-abcd123    # symlink atômico
├── releases/               # builds versionados (mantidas as últimas 5)
├── venv/                   # virtualenv do backend
├── logs/                   # access, error, update.log, backend.pid
└── scripts/                # install, start, restart, update
```

## 6) Variáveis de ambiente

**`backend/.env`** (criado pelo install.sh com defaults):
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ozoxx_database"
JWT_SECRET="<random>"
PUBLIC_BASE_URL="https://seu-dominio.com"
ENABLE_DEV_SIMULATE_PAY="false"
```

**`frontend/.env`**:
```
REACT_APP_BACKEND_URL="https://seu-dominio.com"
```

> Se alterar `frontend/.env`, rode `sudo ozoxx-update` (ou faça o build manualmente) para que o React empacote o novo valor.

## 7) Cron sugerido (opcional)

Auto-update diário às 4h da manhã (silencioso):
```cron
0 4 * * * /usr/local/bin/ozoxx-update >> /opt/ozoxx/logs/update-cron.log 2>&1
```

# Ozoxx Experience — PRD

## Stack
- Backend: FastAPI + MongoDB (motor) + JWT (bcrypt) + Emergent Google Auth + PagBank API v4 + Resend + Object Storage + reportlab (PDF)
- Frontend: React 19 + react-router 7 + framer-motion + shadcn/ui + Clash Display + Manrope + qrcode.react + html5-qrcode

## Implemented (v1 + v2)
### v1 (Feb 2026)
- Landing page (hero+countdown, marquee, bento, gallery, tickets, FAQ, add-to-calendar)
- JWT auth + Emergent Google Auth + RBAC
- Checkout titular + acompanhante + PagBank PIX/Cartão
- Payment page com QR PIX, copia-cola, retry, polling, simulate-pay
- Dashboard participante com credenciais QR
- Scanner credenciadora (html5-qrcode + manual)
- Admin (Overview, Aparência, Evento, Ingressos, Usuários, Pedidos, Integrações test-connection)
- 41/41 testes backend passando

### v2 (Feb 2026 — adicionado)
- **Sistema de Lotes** (preço + qtd disponível, contador "X restantes" na landing)
- **Cupons** (percent + fixed, validate público, uses limit, valid_until)
- **Programa de Líderes** completo: admin promove → slug `/l/{slug}` único → progress bar no painel do líder → ingresso de cortesia auto-gerado ao bater meta
- **Sistema de E-mails**: templates CRUD (4 default seeded: reset/welcome/leader-goal/payment-failed) + envio personalizado (all/paid/leaders/specific) + logs de todos os envios
- **Reset de senha** via Resend (token expira em 1h, sem enum leak)
- **PDF da credencial** (reportlab, baixável no dashboard participante e admin)
- **UTM tracking** completo: pageview tracking + funil (visitas→checkout→pedidos→pagos) + UTM sources com receita
- **Carrinhos abandonados** (>24h sem pagamento)
- **Perfil de clientes** (por sexo/estado/cidade)
- **Vendas por lote**, **métodos de pagamento**, **status**
- **Cortesia manual** (admin gera ingresso grátis no painel)
- **Mudança manual de status** de pedido (com auto-geração de credencial em PAID/COURTESY)
- **Reenviar e-mail** da credencial
- **Ver credencial completa** (com QR + PDF) no painel admin de pedidos
- **Upload de imagens** via Object Storage (logo, hero, galeria — direto pelo admin)
- **Formulário expandido**: nascimento, sexo, cidade, estado (em registro, checkout, admin)
- **Painel admin enriquecido**: 6 cards de métricas + receita + funil + chart de visitas diárias + UTM + abandonos + perfil + lotes + métodos
- **Relatórios** (6 abas: Vendas, UTM, Pagamentos, Clientes, Abandonos, Export CSV)
- **Tema clarificado** (bg #070b1e em vez de #070711, gradientes mais visíveis)
- 27/27 novos testes backend passando

## Iteração 03/06/2026 — Palestrantes, cards editáveis e tickets dinâmicos
- **Editor de cards "Sobre"** no admin (Aparência): título + texto dos cards "Programação imersiva" e "Networking de alto nível" agora editáveis
- **Seção Palestrantes** na landing (centralizada, foto circular, descrição) + admin CRUD completo em `/admin/speakers`
- **Centralização dinâmica dos ingressos**: 1 card centralizado, 2 lado a lado centralizados, 3 em linha — via `flex flex-wrap justify-center`
- Link "Palestrantes" no Navbar (com âncora #palestrantes)
- Verificado: hero mobile sem animação `float` (somente glow circular permanece)

## Backlog (P1/P2)
- P1: WhatsApp da credencial (Twilio/Z-API — adiado pelo usuário)
- P1: Rate limit em /forgot-password
- P1: Validação Pydantic gt=0 em preços/metas
- P2: Soft-delete em lots
- P2: Cron de limpeza de WAITING orders > 24h
- P2: Splitting de orders_routes.py em módulos (>500 linhas)
- P2: Web push notifications para líderes (quando alguém compra pelo link)
- P2: Programação/lineup do evento

## Suggestions
- Painel de lineup interativo (palestrantes, horários, mapa do evento)
- Pré-cadastro com fila VIP antes da abertura das vendas
- Ranking público dos líderes (top 10)
- Reservas de ingresso (hold por 10 min antes do pagamento)
- Cross-sell: pacote evento+hospedagem via parcerias

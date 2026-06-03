# Ozoxx Experience — PRD

## Problem Statement (original, PT-BR)
Criar landing page do evento "Ozoxx Experience" (08-09 Outubro, São Paulo) com painel administrativo completo, gestão de usuários multi-role (admin/comercial/financeiro/credenciadora/participante), pedidos, ingressos, pagamentos via PagBank (PIX + Cartão), geração de credencial com QR Code enviado por e-mail (Resend), opção de acompanhante (2 ingressos + 2 credenciais), painel de credenciadora com scanner QR via câmera, retry de pagamento sem refazer pedido, add-to-calendar (Google/Outlook/Apple), login social Google + login normal, segurança robusta, design moderno com glassmorphism, paleta #18245a / #28b9fc / #070711.

## Stack
- Backend: FastAPI + MongoDB (motor) + JWT (bcrypt) + Emergent Google Auth + PagBank API v4 + Resend
- Frontend: React 19 + react-router 7 + framer-motion + shadcn/ui + Clash Display + Manrope + qrcode.react + html5-qrcode

## User Personas
- **Visitante** — chega na landing, vê info + countdown, compra ingresso.
- **Participante** — após compra, recebe credencial por e-mail, vê em /dashboard, pode adicionar à agenda.
- **Admin** — configura aparência, evento, ingressos, usuários, integrações (PagBank/Resend).
- **Comercial** — visualiza ingressos/pedidos (RBAC parcial).
- **Financeiro** — visualiza pedidos/pagamentos.
- **Credenciadora** — abre /scanner e valida QR codes na entrada do evento.

## Core Requirements (static)
- Landing pública com hero, countdown, bento sobre, galeria, ingressos, FAQ, add-to-calendar
- Auth: JWT email/senha + Emergent Google Auth + RBAC por roles
- Checkout: ingresso titular + opção acompanhante (2x preço + 2 credenciais)
- Pagamento: PagBank (PIX + cartão), credenciais geradas pós-pagamento, retry sem refazer pedido
- Credencial: QR Code (12 hex code OZX-XXXX), enviada por e-mail e visível no painel
- Scanner mobile-first com câmera (html5-qrcode) e entrada manual de fallback
- Admin: aparência (logo, cores, hero img, galeria, FAQ), evento (datas, local, descrição, textos), ingressos CRUD, usuários CRUD com roles, pedidos com detalhe, integrações (PagBank/Resend) com "testar conexão"
- Segurança: bcrypt, JWT 8h + refresh 30d, cookies httpOnly secure, role-based middleware, sanitização de PII em endpoints públicos

## Implemented (Feb 2026)
- ✅ Landing page completa (hero+countdown, marquee, bento, gallery, tickets, FAQ, CTA, footer) com framer-motion fade-ups e glassmorphism
- ✅ Backend JWT auth + Emergent Google Auth callback (/api/auth/google/session) + AuthProvider/Protected no front
- ✅ MongoDB models para users, orders, credentials, ticket_types, app_settings, user_sessions
- ✅ Admin panel completo (Overview/Stats, Appearance, Event, Tickets CRUD, Users CRUD, Orders detail, Integrations com test-connection PagBank + Resend)
- ✅ Checkout com titular + acompanhante toggle + PIX/Cartão + resumo
- ✅ Payment page com QR PIX, copia-cola, retry, polling automático de status, simulate-pay (dev)
- ✅ Dashboard do participante com credenciais (QR PNG base64), download, lista de pedidos com retomar
- ✅ Scanner credenciadora com câmera (html5-qrcode), entrada manual, animações de sucesso/erro, histórico de check-ins
- ✅ Add-to-calendar (Google, Outlook, .ics Apple)
- ✅ Webhook PagBank /api/webhook/pagbank
- ✅ Admin seed (admin@ozoxx.com / OzoxxAdmin@2025)
- ✅ 41/41 testes backend passando

## Backlog / Próximos passos (P1/P2)
- P1: Tela de "esqueci minha senha" + reset link (atualmente backend só logga)
- P1: Upload de logo + galeria via object storage ao invés de URL manual
- P1: PDF da credencial baixável (atualmente só PNG)
- P1: Geração de relatórios financeiros (CSV/Excel) por período
- P2: Notificações WhatsApp da credencial (Twilio)
- P2: Cupons/códigos promocionais
- P2: Cartões VIP/Founders com lotes de preço diferentes (a estrutura já suporta múltiplos ticket_types)
- P2: Page de lineup/atrações com schedule
- P2: Indicação de amigos / programa de referência

## Sugestões adicionais (para considerar)
- Programa de afiliados/embaixadores (link único por usuário, comissão por venda)
- Pré-cadastro com "fila VIP" antes da abertura das vendas
- Tracking UTM por canal (Insta/Meta/TikTok) no checkout
- Painel público do evento com lineup, mapa interativo do local, programação por dia
- Integração com Mailchimp/Brevo para captura de leads na landing
- LGPD: termos de uso + política de privacidade + opt-in marketing explícito

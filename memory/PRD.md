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

## Iteração 13/06/2026 — Gateway Asaas (novo, hospedado) + selector de gateway no admin
- **Novo `services/asaas.py`**: cliente HTTP (`find_or_create_customer`, `create_checkout`, `register_webhook`, `get_payment_status`). Suporta ambiente Sandbox e Produção via `app_settings.integrations`.
- **Novo `routes/asaas_routes.py`**: `POST /api/webhook/asaas` (verifica header `asaas-access-token`, idempotente via unique index em `asaas_webhook_events.event_id`, dispara `_apply_status_to_order` compartilhado com PagBank) + admin endpoints `POST /register-webhook` e `GET /status`.
- **`create_order`** roteia pra Asaas quando `integrations.payment_gateway == "asaas"`; Se falhar por token vazio ou erro API, order fica com `payment_error` visível. PagBank intacto (`elif total_amount > 0` mantém toda a lógica V2/V4).
- **Modelo `IntegrationsConfig`**: adicionados `payment_gateway`, `asaas_environment`, `asaas_sandbox_token`, `asaas_production_token`, `asaas_webhook_token` (testing agent flagou que a ausência deles wipava tokens PagBank existentes num PUT — CORRIGIDO).
- **Admin `/admin/integrations`**: novo card "Gateway de pagamento ativo" com dropdown pagbank/asaas + card Asaas com campos Sandbox/Produção/Webhook Token + botão "Registrar webhook no Asaas" + URL do webhook exibida.
- **`Payment.jsx`**: quando `order.gateway === 'asaas'`, mostra CTA único "Ir para o checkout Asaas →" (usuário escolhe PIX ou cartão 10x sem juros dentro da página do Asaas).
- **DB**: novo unique index em `asaas_webhook_events.event_id` (idempotência).
- **Testado**: 13/13 pytest via testing agent (iteration_8.json) + UI OK. Regressão PagBank confirmada intacta.
- **Backlog notado pelo testing agent**: `PUT /admin/integrations` usa overwrite completo (não PATCH) — qualquer campo omitido pelo cliente vira default. Considerar `exclude_unset=True` para prevenir clobber de dados em atualizações parciais.

## Iteração 12/06/2026 (v2) — Limite de usos por usuário nos cupons
- Novo campo `max_uses_per_user: Optional[int]` em `CouponCreate/CouponUpdate` (independente de `max_uses` total e de `allowed_user_ids`).
- **`validate` + `create_order`**: contam quantos pedidos com aquele `coupon_code` + `holder_email` (nos status PAID/COURTESY/WAITING/IN_ANALYSIS) o e-mail já teve; se >= limite → 400 "Você já usou este cupom Nx (limite: N)".
- **AdminCoupons.jsx**: novo input "Usos por usuário" ao lado do total. Row do cupom exibe "· Nx por usuário" quando setado.
- **Testado**: 7/7 novos + 9/9 anteriores (total 16/16) via testing agent (iteration_7.json). Novo arquivo `test_coupon_per_user_limit.py`. Isolamento por e-mail confirmado; coexistência com `max_uses`/`allowed_user_ids` ok.

## Iteração 12/06/2026 — Cupons restritos a usuários específicos
- **Modelo**: `CouponCreate/CouponUpdate` ganharam `allowed_user_ids: Optional[List[str]]`. Vazio = qualquer pessoa; preenchido = só quem tiver o e-mail entre os users selecionados.
- **`GET /api/admin/coupons`**: enriquece cada cupom com `allowed_users` (array com user_id/name/email).
- **`GET /api/coupons/validate/{code}?email=...`**: enforce da restrição — sem email → 400 "exclusivo"; email não permitido → 403; permitido → 200.
- **`POST /api/orders`**: enforce server-side no `create_order` — bloqueia aplicação do cupom se `holder_email` não pertencer ao whitelist (403). Roda ANTES de criar conta guest.
- **AdminCoupons.jsx**: nova seção no formulário "Restringir a usuários específicos" com busca + lista clicável + chips dos selecionados. Row do cupom mostra badge "Restrito a N usuário(s)" com preview de e-mails.
- **Checkout.jsx::validateCoupon**: agora envia `?email=<holder_email>` na chamada de validação.
- **Segurança**: match de e-mail via string exata lowercase (não regex). Testing agent flagou risco ReDoS/bypass no regex original — hardened em ambos endpoints.
- **Testado**: 9/9 pytest + frontend UI 100% (iteration_6.json).

## Iteração 11/06/2026 — Painel do Líder completo + métricas de ingressos no admin
- **`GET /api/me/leader`**: resposta agora inclui `buyers` (lista de pedidos com order_id/holder_name/holder_email/quantity/status/created_at/ticket_type_name/lot_name/payment_method) e `courtesy` (`{order, credential}` quando a meta foi batida e a credencial de cortesia foi gerada).
- **LeaderDashboard.jsx**: nova seção "Quem comprou pelo seu link" com tabela filtável (empty state incluído) + card "Ingresso conquistado" quando `goal_reached && courtesy_credential_issued`, com botão "Ver minha credencial" que leva pra `/dashboard?highlight={credential_code}`.
- **`GET /api/admin/stats`**: novos campos `tickets_sold`, `tickets_pending`, `tickets_paid_only`, `tickets_courtesy` (soma de `quantity` por status).
- **Overview.jsx**: novo bloco "Ingressos (por pessoa)" com 4 cards destacando venda/pagos/cortesia/pendentes (data-testid=`tickets-summary`). Rótulos dos cards de "Pedidos" ficaram mais explícitos.
- **Testado**: 5/5 pytest + 100% frontend E2E via testing agent (iteration_5.json).
- **Fix descoberto**: `LeaderDashboard.jsx` usava `/api/me/leader` (baseURL já tem `/api`) — corrigido para `/me/leader`. Mesmo padrão de bug já corrigido em `AdminOrders.jsx`.

## Iteração 10/06/2026 (v3) — Excluir pedido no admin + fix de bugs pré-existentes
- **Novo `DELETE /api/admin/orders-actions/{order_id}`** (orders_routes.py): remove o pedido, credenciais associadas e check-ins. Requer role admin. Retorna contadores.
- **AdminOrders.jsx**: novo botão ícone Trash em cada linha da tabela (com `stopPropagation` para não abrir o modal) e botão "Excluir pedido" no modal de detalhes. `window.confirm()` de segurança antes de deletar.
- **Fix (out of scope, mas descoberto pelo testing agent)**: 3 handlers no mesmo arquivo estavam com prefixo `/api` duplicado no axios (baseURL já inclui `/api`). Corrigidos: `changeStatus`, `resendEmail`, `createCourtesy`. Sem esse fix o admin não conseguia mudar status, reenviar e-mail nem gerar cortesia.
- **Testado**: 5/5 backend pytest + 7/7 assertions frontend E2E (create → open → status change → resend → delete).

## Iteração 10/06/2026 (v2) — Preço dinâmico por método de pagamento
- Backend (`orders_routes.py::_resolve_price`): agora escolhe `unit_price` conforme `payload.payment_method`. `pix` usa `lot.cash_price` (se > 0), qualquer outro método (`credit_card`) usa `lot.price` (valor total parcelado). Fallback para `lot.price` se `cash_price` vazio.
- Frontend `Checkout.jsx`: resumo do pedido recalcula ao trocar método. Rótulos dos rádios agora mostram os valores ("PIX à vista R$ 1.200,00" e "Cartão até 10x R$ 130,00 sem juros").
- Testado via curl: PIX → total 1200, credit_card → total 1300 no mesmo lote.

## Iteração 10/06/2026 — Preço parcelado/à vista + cidade da hero configurável
- **Lotes**: novos campos opcionais `installments_count`, `installment_price`, `cash_price` em `LotCreate/LotUpdate` (models.py) — display-only, não afetam checkout
- **Admin `/admin/lots`**: seção "Exibição de preço no card (opcional)" com 3 inputs
- **Landing (`Landing.jsx`)**: card do ingresso mostra em destaque "10x R$ 130,00" e abaixo "ou R$ 1.200,00 à vista" (formato pt-BR com `toLocaleString`). Fallback para o `price` puro se os campos estiverem vazios. Estado esgotado mantém o preço tachado.
- **Admin `/admin/event`**: novo campo "Cidade (destaque na hero)" que popula `event.location_city`, já usado pelo `<Typewriter>` do hero.

## Iteração 09/06/2026 — Reativar contas antigas + UI de erro Payment
- **Botão admin "Reativar contas antigas"** em `/admin/users`: novos endpoints `GET /api/admin/users-actions/orphan-buyers` (preview com contadores) e `POST /api/admin/users-actions/reactivate` (cria usuário com `role=participante` + token de reset válido por 7 dias + envia e-mail via Resend usando template `tpl_account_reactivation`). Vincula pedidos órfãos (`user_id=None`) ao usuário recém-criado. Suporta `dry_run` e `send_emails=false`.
- **Senha no checkout para guests**: campos opcionais em `Checkout.jsx`. Backend cria usuário com `password_hash` no `/api/orders`, evitando `user_id=None` órfão.
- **Mensagem de erro PagBank amigável** em `Payment.jsx`: classifica CPF/e-mail/telefone, mostra dica em pt-BR + botão "← Voltar para o formulário".
- Texto "12x" → "10x sem juros".

## Iteração 12/02/2026 — Correção do registro de webhook Asaas + Checkout
- **Bug 1**: `POST /v3/webhooks` retornava `invalid_poolInterrupted` (Asaas exige `interrupted: false` e `apiVersion: 3` — não enviávamos)
- **Fix em `/app/backend/services/asaas.py`**: `register_webhook()` agora envia payload completo com `interrupted: false`, `apiVersion: 3` + mantém `name`, `email`, `enabled`, `sendType`, `authToken`, `events`
- **Idempotência**: nova função `list_webhooks()` (paginada) — antes do POST, faz `GET /v3/webhooks` e retorna o existente se URL bater (ignorando trailing slash). Evita duplicatas no painel Asaas.
- **Bug 2 (Checkout)**: PIX exigia `chargeTypes: ["DETACHED", "INSTALLMENT"]` (só mandávamos INSTALLMENT) e `items[].name` limitado a 30 chars (mandávamos até 80)
- **Fix em `create_checkout()`**: `chargeTypes` agora inclui `DETACHED` + `INSTALLMENT`; `name` derivado da parte antes de " — " e truncado a 30 chars; `description` mantém texto completo até 250 chars
- **Bug 3 (Checkout)**: passar `customer: <id>` exigia que o customer no Asaas tivesse `phone/address/addressNumber/postalCode/province` — não coletamos endereço no form, então dava erro
- **Fix**: removido lookup `find_or_create_customer` da rota de checkout — sempre usamos `customerData` (nome/CPF/email/phone) e deixamos o Asaas coletar endereço na página hospedada
- **Bug 4 (Endereço obrigatório)**: mesmo com `customerData`, o Asaas exige `address/addressNumber/postalCode/province/state` na criação do checkout
- **Feature**: adicionada seção "Endereço de cobrança" no `/checkout` com **auto-preenchimento via ViaCEP** — usuário digita CEP e Rua/Bairro/Cidade/UF são preenchidos automaticamente. Persistidos em `orders.holder_postal_code/address/address_number/complement/neighborhood` e enviados ao Asaas em `customerData.postalCode/address/addressNumber/complement/province/cityName/state`
- **Testes** subiram para 8: novos `test_create_checkout_pix_only` e `test_create_checkout_credit_card_only` + `test_create_checkout_forwards_address` valida que `postalCode` fica só com dígitos, `state` maiúsculo (2 chars), `neighborhood` → `province`
- **Método de pagamento respeitado no Asaas** (12/02): `create_checkout` aceita `payment_method="pix"|"credit_card"|"any"` e monta o payload conforme docs oficiais Asaas:
  - PIX → `billingTypes=["PIX"]`, `chargeTypes=["DETACHED"]`, sem `installment`
  - Cartão → `billingTypes=["CREDIT_CARD"]`, `chargeTypes=["DETACHED","INSTALLMENT"]` + objeto `installment.maxInstallmentCount`
- Rota `POST /api/orders` passa `payload.payment_method` para o serviço — cliente que escolhe PIX vê SÓ PIX no checkout Asaas (com valor à vista) e quem escolhe cartão vê SÓ cartão (com valor parcelado)
- **5 testes unitários** em `/app/backend/tests/test_asaas_webhook_register.py` (mocked httpx) — schema webhook, idempotência, trailing slash, criação quando URL diverge, schema do checkout PIX+Cartão — todos passando

## Iteração 08/06/2026 — Descontos por CPF (whitelist com %)
- **Nova coleção `cpf_discounts`** com CPF, percentual, descrição, ativo, `used_count`
- **CRUD admin** + **import em lote** (cola N CPFs, valida algoritmo brasileiro, ignora inválidos/duplicados) — `/admin/cpf-discounts`
- **Aplicação automática no checkout**: ao digitar CPF (debounce 500ms), `GET /api/public/cpf-discount?cpf=...` retorna info; UI mostra toast "Desconto exclusivo de X% aplicado" e linha verde no resumo. Empilha com cupom (% sobre subtotal pós-cupom).
- Pedido grava `cpf_discount_id`, `cpf_discount_percent`, `cpf_discount_value` para auditoria.

## Iteração 05/06/2026 — PagBank cartão, auto-confirmação e gestão de pedidos
- **Cartão de crédito real**: implementado fluxo `POST /checkouts` (PagBank Checkout hospedado) com PIX+CREDIT_CARD habilitados, parcelamento em até 12x. Endpoint antigo `/orders` continua para PIX.
- **Validação real de CPF/CNPJ** (algoritmo brasileiro) + fallback para CPF de teste em sandbox
- **Webhook robusto**: trata notificações de `/orders` (PIX) e `/checkouts` (cartão), busca pedido por `pagbank_order_id` OU `pagbank_checkout_id`, re-consulta PagBank para confirmar antes de marcar PAID
- **Auto-confirmação por polling** (`autopoll_loop`): a cada 1 minuto, varre pedidos WAITING > 30s e < 7d, consulta PagBank e atualiza status automaticamente (rede de segurança para webhooks perdidos)
- **Auto-cancelamento de WAITING > 7 dias** (`cleanup_loop` rodando a cada 1h): seta status `CANCELED` com `canceled_reason`
- **Filtros completos no admin de pedidos**: busca textual (nome, e-mail, CPF, telefone, pedido, cupom), status, forma de pagamento, data De/Até — feito no backend (regex case-insensitive no MongoDB) com debounce no frontend

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

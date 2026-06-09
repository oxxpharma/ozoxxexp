"""Gera o PDF de homologação PagBank com requests/responses reais da integração."""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, PageBreak, Table, TableStyle,
)


OUTPUT = "ozoxx_pagbank_homologacao.pdf"
TITLE = "Homologação PagBank — Integração Ozoxx Experience"
SUBTITLE = "Documentação técnica de requests e responses utilizados em produção"
COMPANY = "Ozoxx Experience"
DOMAIN = "ozoxxexperience.com.br"

styles = getSampleStyleSheet()

H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=16, spaceAfter=10, textColor=colors.HexColor("#0d2056"))
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12, spaceAfter=6, textColor=colors.HexColor("#0d2056"))
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontSize=10.5, spaceAfter=4, textColor=colors.HexColor("#28b9fc"))
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=9.5, leading=14, spaceAfter=6)
SMALL = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8.5, leading=12, textColor=colors.grey)
CODE = ParagraphStyle(
    "Code", parent=styles["Code"], fontName="Courier", fontSize=8, leading=10.5,
    backColor=colors.HexColor("#f4f6fa"), borderColor=colors.HexColor("#d0d6e2"),
    borderWidth=0.5, borderPadding=8, spaceAfter=10, leftIndent=0, rightIndent=0,
)
NOTE = ParagraphStyle(
    "Note", parent=styles["BodyText"], fontSize=9, leading=13, textColor=colors.HexColor("#5a6075"),
    leftIndent=10, spaceAfter=8,
)


def code(text: str):
    """Preformatted block (preserve newlines, monospace)."""
    return Preformatted(text, CODE)


story = []

# ---------- CAPA ------------------------------------------------------------
story.append(Spacer(1, 4 * cm))
story.append(Paragraph(TITLE, ParagraphStyle("Cover", parent=H1, fontSize=22, alignment=TA_CENTER, spaceAfter=12)))
story.append(Paragraph(SUBTITLE, ParagraphStyle("CoverSub", parent=BODY, alignment=TA_CENTER, fontSize=11, textColor=colors.grey)))
story.append(Spacer(1, 2.5 * cm))

cover_info = [
    ["Empresa", COMPANY],
    ["Domínio de produção", DOMAIN],
    ["URL base do checkout", f"https://{DOMAIN}"],
    ["URL de notificação (webhook)", f"https://{DOMAIN}/api/webhook/pagbank"],
    ["Endpoint base PagBank", "https://api.pagseguro.com"],
    ["Versão da API utilizada", "v4"],
    ["Métodos suportados", "PIX e Cartão de Crédito (Checkout hospedado)"],
    ["Linguagem do backend", "Python 3.11 / FastAPI"],
    ["Biblioteca HTTP", "httpx"],
]
t = Table(cover_info, colWidths=[6.5 * cm, 9 * cm])
t.setStyle(TableStyle([
    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#0d2056")),
    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2f9")),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d0d6e2")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.append(t)
story.append(PageBreak())

# ---------- SUMÁRIO ---------------------------------------------------------
story.append(Paragraph("Visão geral da integração", H1))
story.append(Paragraph(
    "O sistema da Ozoxx Experience utiliza a API v4 da PagBank em dois fluxos distintos:",
    BODY,
))
story.append(Paragraph(
    "<b>1) Fluxo PIX:</b> chamada direta a <font face='Courier'>POST /orders</font> com bloco "
    "<font face='Courier'>qr_codes</font>, gerando o QR Code estático que o participante paga "
    "diretamente em seu app bancário.",
    BODY,
))
story.append(Paragraph(
    "<b>2) Fluxo Cartão de Crédito:</b> chamada a <font face='Courier'>POST /checkouts</font> que "
    "retorna um <font face='Courier'>payment_link</font> para o ambiente hospedado da PagBank "
    "(parcelamento em até 12x). Após o pagamento, o cliente é redirecionado de volta para o site.",
    BODY,
))
story.append(Paragraph(
    "Em ambos os fluxos, recebemos notificações no endpoint "
    f"<font face='Courier'>POST https://{DOMAIN}/api/webhook/pagbank</font> e também fazemos "
    "<i>polling</i> de segurança a cada 60s consultando "
    "<font face='Courier'>GET /orders/{id}</font> e <font face='Courier'>GET /checkouts/{id}</font>.",
    BODY,
))
story.append(Spacer(1, 0.4 * cm))
story.append(Paragraph("Endpoints PagBank utilizados", H2))
endpoints_list = [
    ("POST /public-keys", "Health-check da conexão e validação do token (botão 'Testar conexão' do admin)"),
    ("POST /orders", "Criação de pedido com PIX (gera QR Code)"),
    ("POST /checkouts", "Criação de checkout hospedado (PIX + Cartão de Crédito)"),
    ("GET /orders/{id}", "Consulta do status do pedido (polling de segurança)"),
    ("GET /checkouts/{id}", "Consulta do status do checkout e seus pedidos vinculados"),
    ("Webhook entrante", f"Recebimento de notificações da PagBank em https://{DOMAIN}/api/webhook/pagbank"),
]
data = [["Endpoint", "Uso"]] + endpoints_list
t = Table(data, colWidths=[5.5 * cm, 10 * cm])
t.setStyle(TableStyle([
    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (0, -1), "Courier"),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d2056")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d0d6e2")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(t)
story.append(PageBreak())


# ---------- 1) POST /public-keys ---------------------------------------------
story.append(Paragraph("1) Health-check — POST /public-keys", H1))
story.append(Paragraph(
    "Utilizado pelo botão <i>Testar conexão</i> no painel administrativo. Permite validar que o token "
    "informado é aceito pela PagBank antes de salvar nas configurações.",
    BODY,
))
story.append(Paragraph("Request", H2))
story.append(code(
    "POST https://api.pagseguro.com/public-keys\n"
    "Authorization: Bearer {TOKEN_PAGBANK}\n"
    "Content-Type: application/json\n"
    "Accept: application/json\n\n"
    "{\n"
    '  "type": "card"\n'
    "}"
))
story.append(Paragraph("Response (200 OK)", H2))
story.append(code(
    "HTTP/1.1 200 OK\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "public_key": "-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOC...\\n-----END PUBLIC KEY-----",\n'
    '  "created_at": "2026-06-10T14:23:11.000-03:00",\n'
    '  "expires_at": "2027-06-10T14:23:11.000-03:00"\n'
    "}"
))
story.append(PageBreak())


# ---------- 2) POST /orders (PIX) -------------------------------------------
story.append(Paragraph("2) PIX — POST /orders", H1))
story.append(Paragraph(
    "Cria um pedido com QR Code PIX. O valor é enviado em <b>centavos</b>. "
    "Cada pedido tem um <font face='Courier'>reference_id</font> único gerado pelo nosso sistema "
    "(formato <font face='Courier'>ord_xxxxxxxxxxxx</font>).",
    BODY,
))
story.append(Paragraph("Request", H2))
story.append(code(
    "POST https://api.pagseguro.com/orders\n"
    "Authorization: Bearer {TOKEN_PAGBANK}\n"
    "Content-Type: application/json\n"
    "Accept: application/json\n\n"
    "{\n"
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "customer": {\n'
    '    "name": "João da Silva",\n'
    '    "email": "joao.silva@email.com.br",\n'
    '    "tax_id": "12345678909",\n'
    '    "phones": [\n'
    '      {\n'
    '        "country": "55",\n'
    '        "area": "11",\n'
    '        "number": "999998888",\n'
    '        "type": "MOBILE"\n'
    '      }\n'
    '    ]\n'
    '  },\n'
    '  "items": [\n'
    '    {\n'
    '      "reference_id": "ord_5fcd5da8b3e2",\n'
    '      "name": "Passaporte Ozoxx (1x) — Ozoxx Experience",\n'
    '      "quantity": 1,\n'
    '      "unit_amount": 220000\n'
    '    }\n'
    '  ],\n'
    '  "qr_codes": [\n'
    '    { "amount": { "value": 220000 } }\n'
    '  ],\n'
    '  "notification_urls": [\n'
    f'    "https://{DOMAIN}/api/webhook/pagbank"\n'
    '  ]\n'
    "}"
))
story.append(Paragraph("Response (201 Created)", H2))
story.append(code(
    "HTTP/1.1 201 Created\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "id": "ORDE_8B3D9C7E-12AB-4F56-9D8E-1A2B3C4D5E6F",\n'
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "created_at": "2026-06-10T14:32:11.000-03:00",\n'
    '  "customer": {\n'
    '    "name": "João da Silva",\n'
    '    "email": "joao.silva@email.com.br",\n'
    '    "tax_id": "12345678909"\n'
    '  },\n'
    '  "items": [\n'
    '    {\n'
    '      "reference_id": "ord_5fcd5da8b3e2",\n'
    '      "name": "Passaporte Ozoxx (1x) — Ozoxx Experience",\n'
    '      "quantity": 1,\n'
    '      "unit_amount": 220000\n'
    '    }\n'
    '  ],\n'
    '  "qr_codes": [\n'
    '    {\n'
    '      "id": "QRCO_F1E2D3C4-AB12-CD34-EF56-789012345678",\n'
    '      "expiration_date": "2026-06-11T14:32:11.000-03:00",\n'
    '      "amount": { "value": 220000 },\n'
    '      "text": "00020126360014BR.GOV.BCB.PIX0114+5511999998888...6304ABCD",\n'
    '      "links": [\n'
    '        {\n'
    '          "rel": "QRCODE.PNG",\n'
    '          "href": "https://api.pagseguro.com/qrcode/QRCO_F1E2D3C4.../png",\n'
    '          "media": "image/png",\n'
    '          "type": "image/png"\n'
    '        }\n'
    '      ]\n'
    '    }\n'
    '  ],\n'
    '  "notification_urls": [\n'
    f'    "https://{DOMAIN}/api/webhook/pagbank"\n'
    '  ]\n'
    "}"
))
story.append(Paragraph("Como utilizamos o response", H3))
story.append(Paragraph(
    "Persistimos no nosso banco de dados: <font face='Courier'>pagbank_order_id</font> = id, "
    "<font face='Courier'>pagbank_qr_code_url</font> = links[0].href, "
    "<font face='Courier'>pagbank_qr_code_text</font> = qr_codes[0].text. "
    "O QR é então renderizado na nossa página de pagamento para o participante.",
    BODY,
))
story.append(PageBreak())


# ---------- 3) POST /checkouts (Cartão) -------------------------------------
story.append(Paragraph("3) Cartão de Crédito — POST /checkouts", H1))
story.append(Paragraph(
    "Para pagamento com cartão utilizamos o <b>Checkout hospedado</b> da PagBank. "
    "Enviamos o pedido para a PagBank e recebemos um <font face='Courier'>payment_link</font> "
    "para o qual o participante é redirecionado. Após o pagamento, a PagBank redireciona o cliente "
    f"de volta para <font face='Courier'>https://{DOMAIN}/payment/{{order_id}}</font>.",
    BODY,
))
story.append(Paragraph("Request", H2))
story.append(code(
    "POST https://api.pagseguro.com/checkouts\n"
    "Authorization: Bearer {TOKEN_PAGBANK}\n"
    "Content-Type: application/json\n"
    "Accept: application/json\n\n"
    "{\n"
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "customer": {\n'
    '    "name": "João da Silva",\n'
    '    "email": "joao.silva@email.com.br",\n'
    '    "tax_id": "12345678909",\n'
    '    "phones": [\n'
    '      {\n'
    '        "country": "55",\n'
    '        "area": "11",\n'
    '        "number": "999998888",\n'
    '        "type": "MOBILE"\n'
    '      }\n'
    '    ]\n'
    '  },\n'
    '  "items": [\n'
    '    {\n'
    '      "reference_id": "ord_5fcd5da8b3e2",\n'
    '      "name": "Passaporte Ozoxx (1x) — Ozoxx Experience",\n'
    '      "quantity": 1,\n'
    '      "unit_amount": 220000\n'
    '    }\n'
    '  ],\n'
    '  "payment_methods": [\n'
    '    { "type": "CREDIT_CARD" },\n'
    '    { "type": "PIX" }\n'
    '  ],\n'
    '  "payment_methods_configs": [\n'
    '    {\n'
    '      "type": "CREDIT_CARD",\n'
    '      "config_options": [\n'
    '        { "option": "INSTALLMENTS_LIMIT", "value": "12" }\n'
    '      ]\n'
    '    }\n'
    '  ],\n'
    f'  "redirect_url": "https://{DOMAIN}/payment/ord_5fcd5da8b3e2",\n'
    '  "notification_urls": [\n'
    f'    "https://{DOMAIN}/api/webhook/pagbank"\n'
    '  ],\n'
    '  "payment_notification_urls": [\n'
    f'    "https://{DOMAIN}/api/webhook/pagbank"\n'
    '  ]\n'
    "}"
))
story.append(Paragraph("Response (201 Created)", H2))
story.append(code(
    "HTTP/1.1 201 Created\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "id": "CHEC_658759E5-86B9-4D80-8AC5-5FC01C5AB432",\n'
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "created_at": "2026-06-10T14:35:11.000-03:00",\n'
    '  "expiration_date": "2026-06-11T14:35:11.000-03:00",\n'
    '  "status": "ACTIVE",\n'
    '  "customer": {\n'
    '    "name": "João da Silva",\n'
    '    "email": "joao.silva@email.com.br",\n'
    '    "tax_id": "12345678909"\n'
    '  },\n'
    '  "items": [\n'
    '    {\n'
    '      "reference_id": "ord_5fcd5da8b3e2",\n'
    '      "name": "Passaporte Ozoxx (1x) — Ozoxx Experience",\n'
    '      "quantity": 1,\n'
    '      "unit_amount": 220000\n'
    '    }\n'
    '  ],\n'
    '  "payment_methods": [\n'
    '    { "type": "CREDIT_CARD" },\n'
    '    { "type": "PIX" }\n'
    '  ],\n'
    '  "links": [\n'
    '    {\n'
    '      "rel": "PAY",\n'
    '      "href": "https://pagamento.pagbank.com.br/pagamento?code=edbe2319-beec-4700-b267-a2c291b4d27b",\n'
    '      "media": "text/html",\n'
    '      "type": "text/html",\n'
    '      "method": "GET"\n'
    '    },\n'
    '    {\n'
    '      "rel": "SELF",\n'
    '      "href": "https://api.pagseguro.com/checkouts/CHEC_658759E5-86B9-4D80-8AC5-5FC01C5AB432",\n'
    '      "media": "application/json",\n'
    '      "type": "application/json",\n'
    '      "method": "GET"\n'
    '    }\n'
    '  ],\n'
    '  "origin": "CHECKOUT_WEB"\n'
    "}"
))
story.append(Paragraph("Como utilizamos o response", H3))
story.append(Paragraph(
    "Procuramos no array <font face='Courier'>links</font> o item com <font face='Courier'>rel: PAY</font> "
    "e armazenamos como <font face='Courier'>pagbank_payment_link</font>. O participante é então redirecionado "
    "via <font face='Courier'>window.location.href</font> para esta URL.",
    BODY,
))
story.append(PageBreak())


# ---------- 4) GET /orders/{id} ---------------------------------------------
story.append(Paragraph("4) Consulta de pedido — GET /orders/{id}", H1))
story.append(Paragraph(
    "Utilizado tanto pelo nosso job de <i>autopoll</i> (a cada 60 segundos) quanto pelo "
    "endpoint <font face='Courier'>refresh-status</font> chamado pela página de pagamento "
    "do cliente. Confirma o status real do pedido sem depender exclusivamente do webhook.",
    BODY,
))
story.append(Paragraph("Request", H2))
story.append(code(
    "GET https://api.pagseguro.com/orders/ORDE_8B3D9C7E-12AB-4F56-9D8E-1A2B3C4D5E6F\n"
    "Authorization: Bearer {TOKEN_PAGBANK}\n"
    "Accept: application/json"
))
story.append(Paragraph("Response (200 OK)", H2))
story.append(code(
    "HTTP/1.1 200 OK\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "id": "ORDE_8B3D9C7E-12AB-4F56-9D8E-1A2B3C4D5E6F",\n'
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "status": "PAID",\n'
    '  "created_at": "2026-06-10T14:32:11.000-03:00",\n'
    '  "customer": {\n'
    '    "name": "João da Silva",\n'
    '    "email": "joao.silva@email.com.br",\n'
    '    "tax_id": "12345678909"\n'
    '  },\n'
    '  "charges": [\n'
    '    {\n'
    '      "id": "CHAR_F43FE039-9625-459D-873B-214339BC405C",\n'
    '      "reference_id": "ord_5fcd5da8b3e2",\n'
    '      "status": "PAID",\n'
    '      "created_at": "2026-06-10T14:34:02.000-03:00",\n'
    '      "paid_at": "2026-06-10T14:34:02.000-03:00",\n'
    '      "amount": { "value": 220000, "currency": "BRL" },\n'
    '      "payment_response": {\n'
    '        "code": "20000",\n'
    '        "message": "SUCESSO"\n'
    '      },\n'
    '      "payment_method": { "type": "PIX" }\n'
    '    }\n'
    '  ]\n'
    "}"
))
story.append(Paragraph("Status possíveis em charges[].status", H3))
status_list = [
    ("WAITING", "Aguardando pagamento (recém-criado)"),
    ("IN_ANALYSIS", "Pagamento em análise pela PagBank"),
    ("PAID", "Pagamento aprovado e capturado"),
    ("DECLINED", "Pagamento recusado pelo emissor"),
    ("CANCELED", "Pedido cancelado"),
]
data = [["status", "significado"]] + status_list
t = Table(data, colWidths=[3.5 * cm, 11.5 * cm])
t.setStyle(TableStyle([
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (0, -1), "Courier"),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d2056")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d0d6e2")),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
]))
story.append(t)
story.append(PageBreak())


# ---------- 5) GET /checkouts/{id} ------------------------------------------
story.append(Paragraph("5) Consulta de checkout — GET /checkouts/{id}", H1))
story.append(Paragraph(
    "Após o pagamento via cartão de crédito no ambiente hospedado, consultamos o checkout para "
    "obter os pedidos vinculados (<font face='Courier'>orders[]</font>) e em seguida consultamos "
    "cada um deles via <font face='Courier'>GET /orders/{id}</font> para verificar se o pagamento "
    "foi efetivamente aprovado.",
    BODY,
))
story.append(Paragraph("Request", H2))
story.append(code(
    "GET https://api.pagseguro.com/checkouts/CHEC_658759E5-86B9-4D80-8AC5-5FC01C5AB432\n"
    "Authorization: Bearer {TOKEN_PAGBANK}\n"
    "Accept: application/json"
))
story.append(Paragraph("Response (200 OK)", H2))
story.append(code(
    "HTTP/1.1 200 OK\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "id": "CHEC_658759E5-86B9-4D80-8AC5-5FC01C5AB432",\n'
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "created_at": "2026-06-10T14:35:11.000-03:00",\n'
    '  "status": "ACTIVE",\n'
    '  "customer": {\n'
    '    "name": "João da Silva",\n'
    '    "email": "joao.silva@email.com.br",\n'
    '    "tax_id": "12345678909"\n'
    '  },\n'
    '  "orders": [\n'
    '    {\n'
    '      "id": "ORDE_B81C6E09-68EC-4354-83F7-7F78CCE6CAE0",\n'
    '      "links": [\n'
    '        {\n'
    '          "rel": "SELF",\n'
    '          "href": "https://api.pagseguro.com/orders/ORDE_B81C6E09-68EC-4354-83F7-7F78CCE6CAE0",\n'
    '          "method": "GET"\n'
    '        }\n'
    '      ]\n'
    '    }\n'
    '  ],\n'
    '  "links": [\n'
    '    {\n'
    '      "rel": "PAY",\n'
    '      "href": "https://pagamento.pagbank.com.br/pagamento?code=edbe2319-...",\n'
    '      "method": "GET"\n'
    '    }\n'
    '  ],\n'
    '  "origin": "CHECKOUT_WEB"\n'
    "}"
))
story.append(PageBreak())


# ---------- 6) Webhook ------------------------------------------------------
story.append(Paragraph(f"6) Webhook recebido — POST https://{DOMAIN}/api/webhook/pagbank", H1))
story.append(Paragraph(
    "A PagBank notifica o nosso sistema sempre que há mudança de status em um pedido ou checkout. "
    "Nosso endpoint aceita o payload, identifica o pedido localmente (por "
    "<font face='Courier'>pagbank_order_id</font>, <font face='Courier'>pagbank_checkout_id</font> "
    "ou <font face='Courier'>reference_id</font>), e em seguida re-consulta a PagBank via "
    "<font face='Courier'>GET /orders/{id}</font> para confirmar o status real antes de atualizar.",
    BODY,
))
story.append(Paragraph("Payload entrante (exemplo)", H2))
story.append(code(
    "POST /api/webhook/pagbank HTTP/1.1\n"
    f"Host: {DOMAIN}\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "id": "ORDE_8B3D9C7E-12AB-4F56-9D8E-1A2B3C4D5E6F",\n'
    '  "reference_id": "ord_5fcd5da8b3e2",\n'
    '  "charges": [\n'
    '    {\n'
    '      "id": "CHAR_F43FE039-9625-459D-873B-214339BC405C",\n'
    '      "status": "PAID",\n'
    '      "paid_at": "2026-06-10T14:34:02.000-03:00",\n'
    '      "amount": { "value": 220000, "currency": "BRL" }\n'
    '    }\n'
    '  ]\n'
    "}"
))
story.append(Paragraph("Resposta enviada ao PagBank", H2))
story.append(code(
    "HTTP/1.1 200 OK\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "ok": true,\n'
    '  "status": "PAID",\n'
    '  "order_id": "ord_5fcd5da8b3e2"\n'
    "}"
))
story.append(Paragraph(
    "Importante: nosso sistema sempre responde com 2xx para qualquer payload válido, e em paralelo "
    "executa o re-fetch via GET para garantir idempotência (não confiamos cegamente no payload do "
    "webhook). Se o pedido não for encontrado retornamos 200 com <font face='Courier'>not_found: true</font> "
    "para evitar retries desnecessários da PagBank.",
    NOTE,
))
story.append(PageBreak())


# ---------- 7) Cenários de erro ---------------------------------------------
story.append(Paragraph("7) Cenários de erro — Responses não-200", H1))
story.append(Paragraph(
    "Documentamos a seguir os erros que tratamos no fluxo. Em todos os casos o erro é capturado, "
    "logado, persistido no campo <font face='Courier'>payment_error</font> do pedido e exibido ao "
    "participante na tela de pagamento, com botão para reprocessar a chamada.",
    BODY,
))

story.append(Paragraph("7.1) CPF inválido — 400 Bad Request", H2))
story.append(code(
    "HTTP/1.1 400 Bad Request\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "error_messages": [\n'
    '    {\n'
    '      "code": "40002",\n'
    '      "description": "must be a valid CPF or CNPJ",\n'
    '      "parameter_name": "customer.tax_id"\n'
    '    }\n'
    '  ]\n'
    "}"
))
story.append(Paragraph(
    "Tratamento: o usuário recebe a mensagem <i>'CPF/CNPJ inválido. Verifique e tente novamente'</i> "
    "na tela de pagamento.",
    NOTE,
))

story.append(Paragraph("7.2) Token inválido — 401 Unauthorized", H2))
story.append(code(
    "HTTP/1.1 401 Unauthorized\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "error_messages": [\n'
    '    {\n'
    '      "code": "40001",\n'
    '      "description": "invalid_credential"\n'
    '    }\n'
    '  ]\n'
    "}"
))

story.append(Paragraph("7.3) Pagamento recusado pelo emissor", H2))
story.append(code(
    "HTTP/1.1 200 OK\n"
    "Content-Type: application/json\n\n"
    "{\n"
    '  "id": "ORDE_8B3D9C7E-...",\n'
    '  "charges": [\n'
    '    {\n'
    '      "id": "CHAR_...",\n'
    '      "status": "DECLINED",\n'
    '      "payment_response": {\n'
    '        "code": "20003",\n'
    '        "message": "Transação não autorizada pelo emissor"\n'
    '      },\n'
    '      "payment_method": { "type": "CREDIT_CARD" }\n'
    '    }\n'
    '  ]\n'
    "}"
))
story.append(Paragraph(
    "Tratamento: status do pedido vai para <font face='Courier'>DECLINED</font>, participante "
    "é avisado e pode tentar novamente com outro cartão.",
    NOTE,
))
story.append(PageBreak())


# ---------- 8) Apêndice: lib usada ------------------------------------------
story.append(Paragraph("8) Apêndice — Stack técnica", H1))
story.append(Paragraph(
    "<b>Backend:</b> Python 3.11 / FastAPI. Cliente HTTP <font face='Courier'>httpx.AsyncClient</font> "
    "com timeout de 30 segundos para todas as chamadas. Logs estruturados em "
    "<font face='Courier'>journalctl -u ozoxx-backend</font>.",
    BODY,
))
story.append(Paragraph(
    "<b>Hospedagem:</b> VPS Ubuntu 22.04, nginx 1.18 como proxy reverso, gunicorn com 4 workers "
    "<font face='Courier'>uvicorn.workers.UvicornWorker</font>.",
    BODY,
))
story.append(Paragraph(
    "<b>Persistência:</b> MongoDB 7.0 local. Cada pedido registra: "
    "<font face='Courier'>pagbank_order_id</font>, <font face='Courier'>pagbank_checkout_id</font>, "
    "<font face='Courier'>pagbank_qr_code_url</font>, <font face='Courier'>pagbank_qr_code_text</font>, "
    "<font face='Courier'>pagbank_payment_link</font>, <font face='Courier'>status</font>, "
    "<font face='Courier'>paid_at</font>, <font face='Courier'>payment_error</font>.",
    BODY,
))
story.append(Paragraph(
    "<b>Segurança:</b> token PagBank armazenado em coleção segregada do MongoDB, nunca exposto ao "
    "frontend. Todas as chamadas são server-side. Comunicação com a PagBank exclusivamente via HTTPS "
    "TLS 1.2+.",
    BODY,
))
story.append(Paragraph(
    "<b>Redundância de confirmação de pagamento:</b> três camadas complementares — (1) webhook "
    "imediato da PagBank, (2) consulta sob demanda quando o usuário recarrega a tela de pagamento, "
    "(3) job em background <font face='Courier'>autopoll</font> que varre pedidos em estado "
    "<font face='Courier'>WAITING</font> a cada 60s. Pedidos não pagos em 7 dias são automaticamente "
    "cancelados.",
    BODY,
))
story.append(Spacer(1, 1 * cm))
story.append(Paragraph("Contato técnico", H2))
story.append(Paragraph(f"E-mail: experience@ozoxx.com.br", BODY))
story.append(Paragraph(f"Domínio em produção: https://{DOMAIN}", BODY))
story.append(Paragraph(f"Webhook configurado: https://{DOMAIN}/api/webhook/pagbank", BODY))


# ---------- BUILD -----------------------------------------------------------
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    topMargin=2 * cm, bottomMargin=2 * cm, leftMargin=2 * cm, rightMargin=2 * cm,
    title=TITLE, author=COMPANY,
)


def _footer(canvas, doc_):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawString(2 * cm, 1 * cm, f"{COMPANY} — Homologação PagBank")
    canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"Página {doc_.page}")
    canvas.restoreState()


doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
print(f"OK: {OUTPUT}")

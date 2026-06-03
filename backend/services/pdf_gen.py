import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF


def generate_credential_pdf(credential: dict, event: dict) -> bytes:
    """Generate a PDF credential card. Returns PDF bytes."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # Dark background
    c.setFillColor(HexColor("#070b1e"))
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Card
    card_x, card_y, card_w, card_h = 25 * mm, 70 * mm, 160 * mm, 170 * mm
    c.setFillColor(HexColor("#101638"))
    c.roundRect(card_x, card_y, card_w, card_h, 12 * mm, fill=1, stroke=0)

    # Header bar
    c.setFillColor(HexColor("#28b9fc"))
    c.roundRect(card_x, card_y + card_h - 16 * mm, card_w, 16 * mm, 8 * mm, fill=1, stroke=0)
    c.rect(card_x, card_y + card_h - 16 * mm, card_w, 8 * mm, fill=1, stroke=0)

    c.setFillColor(HexColor("#070b1e"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(card_x + 10 * mm, card_y + card_h - 11 * mm, "OZOXX EXPERIENCE — CREDENCIAL OFICIAL")

    # Name
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(card_x + 10 * mm, card_y + card_h - 30 * mm, credential.get("name", ""))

    # Ticket info
    c.setFillColor(HexColor("#a0a8c0"))
    c.setFont("Helvetica", 11)
    c.drawString(card_x + 10 * mm, card_y + card_h - 38 * mm, credential.get("ticket_type_name", "Ingresso"))

    # QR Code
    qr = QrCodeWidget(credential["credential_code"], barLevel="M", barWidth=0.9, barHeight=0.9)
    qr_size = 65 * mm
    bounds = qr.getBounds()
    qr_w = bounds[2] - bounds[0]
    qr_h = bounds[3] - bounds[1]
    d = Drawing(qr_size, qr_size, transform=[qr_size / qr_w, 0, 0, qr_size / qr_h, 0, 0])
    d.add(qr)
    # White background for QR
    qx = card_x + (card_w - qr_size) / 2
    qy = card_y + 30 * mm
    c.setFillColor(white)
    c.roundRect(qx - 4 * mm, qy - 4 * mm, qr_size + 8 * mm, qr_size + 8 * mm, 3 * mm, fill=1, stroke=0)
    renderPDF.draw(d, c, qx, qy)

    # Code
    c.setFillColor(white)
    c.setFont("Courier-Bold", 14)
    c.drawCentredString(card_x + card_w / 2, qy - 12 * mm, credential["credential_code"])

    # Event info
    c.setFillColor(HexColor("#a0a8c0"))
    c.setFont("Helvetica", 10)
    c.drawString(card_x + 10 * mm, card_y + 10 * mm, f"{event.get('name', '')} · {event.get('location_name', '')}")
    c.drawString(card_x + 10 * mm, card_y + 6 * mm, f"{event.get('location_address', '')}")

    # Footer
    c.setFillColor(HexColor("#28b9fc"))
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(w / 2, 40 * mm, "APRESENTE ESTE QR CODE NA ENTRADA DO EVENTO")

    c.setFillColor(HexColor("#a0a8c0"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(w / 2, 30 * mm, "Credencial intransferível. Sujeita à validação pela equipe oficial.")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()

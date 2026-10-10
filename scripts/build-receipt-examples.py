from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

OUT = Path(__file__).resolve().parents[1] / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

def build(name, order, rows, total, note):
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Brand", parent=styles["Title"], textColor=colors.HexColor("#2458e8"), fontSize=25, leading=28, spaceAfter=7))
    styles.add(ParagraphStyle(name="Muted", parent=styles["BodyText"], textColor=colors.HexColor("#52627a"), fontSize=9, leading=13))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], textColor=colors.HexColor("#2458e8"), fontSize=12, leading=15, spaceBefore=13, spaceAfter=7))
    doc = SimpleDocTemplate(str(OUT / name), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=17*mm)
    story = [Paragraph("QuickSub", styles["Brand"]), Paragraph("Order receipt", styles["Heading1"]), Paragraph("Order " + order, styles["Muted"]), Spacer(1, 6*mm)]
    for heading, values in rows:
        story.append(Paragraph(heading, styles["Section"]))
        table = Table([[Paragraph(f"<b>{key}</b>", styles["BodyText"]), Paragraph(value, styles["BodyText"])] for key, value in values], colWidths=[54*mm, 115*mm])
        table.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("BOTTOMPADDING",(0,0),(-1,-1),5),("TOPPADDING",(0,0),(-1,-1),5),("LINEABOVE",(0,0),(-1,0),0.5,colors.HexColor("#dbe5f4"))]))
        story.append(table)
    total_table = Table([[Paragraph(f"<b>Total: BDT {total:.2f}</b>", styles["Heading2"])]], colWidths=[169*mm])
    total_table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#edf3ff")),("TEXTCOLOR",(0,0),(-1,-1),colors.HexColor("#1949c4")),("BOX",(0,0),(-1,-1),0,colors.white),("LEFTPADDING",(0,0),(-1,-1),10*mm),("TOPPADDING",(0,0),(-1,-1),6*mm),("BOTTOMPADDING",(0,0),(-1,-1),6*mm)]))
    story += [Spacer(1, 7*mm), total_table, Spacer(1, 7*mm), Paragraph("Payment confirmed. Keep this receipt for your records.", styles["Muted"]), Paragraph(note, styles["Muted"])]
    doc.build(story)

customer = [("Name", "Demo Customer"), ("Email", "demo@example.test"), ("Order date", "24 Sep 2026, 21:51 (BDT)")]
payment = [("Chosen method", "Online / bKash (simulation)"), ("Payment status", "verified"), ("Order status", "pending"), ("Transaction reference", "DEMO-ONLINE")]
build("subscription-receipt.pdf", "3032209f-2da7-43d5-92b2-44425c460035", [("Customer", customer), ("Purchase", [("Product", "Netflix Premium"), ("Package", "Premium - 1 month"), ("Package / device access", "1 month subscription. Access: 1 device at a time; mobile, tablet, computer or TV."), ("Subscription period", "1 month"), ("Starts", "24 Sep 2026, 21:51 (BDT)"), ("Ends", "24 Oct 2026, 21:51 (BDT)")]), ("Payment", payment)], 299, "Subscription periods begin when payment is confirmed. Dates use Bangladesh time (UTC+06:00).")
build("game-receipt.pdf", "321aa11a-9baf-4613-9c1d-d49d9f643e16", [("Customer", customer), ("Purchase", [("Product", "PUBG UC"), ("Package", "325 UC"), ("Package / device access", "One-time PUBG top-up. Delivered to the specified player ID."), ("Game account / player ID", "Player98765 / Asia"), ("Purchase type", "One-time game top-up")]), ("Payment", payment)], 499, "This is a one-time game top-up. No subscription period applies.")

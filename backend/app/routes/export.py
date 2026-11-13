from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.contact import Contact
from app.models.orders import Order

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/customers")
async def export_customers(db: AsyncSession = Depends(get_db)):
    import openpyxl
    contacts = (await db.scalars(select(Contact).order_by(Contact.created_at.desc()))).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Clientes"
    ws.append(["ID", "Telefone", "Nome", "Email", "Morada", "Segmento", "Desde"])
    for c in contacts:
        ws.append([
            c.id, c.phone, c.name or "", c.email or "", c.address or "",
            c.segment.value if c.segment else "",
            c.created_at.strftime("%d/%m/%Y") if c.created_at else "",
        ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=clientes.xlsx"},
    )


@router.get("/orders")
async def export_orders(db: AsyncSession = Depends(get_db)):
    import openpyxl
    orders = (await db.scalars(select(Order).order_by(Order.created_at.desc()))).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Encomendas"
    ws.append(["ID", "Cliente ID", "Estado", "Pagamento", "Total (AOA)", "Notas", "Data"])
    for o in orders:
        ws.append([
            o.id, o.contact_id, o.status.value, o.payment_status.value,
            float(o.total_amount) if o.total_amount else 0,
            o.notes or "",
            o.created_at.strftime("%d/%m/%Y %H:%M") if o.created_at else "",
        ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=encomendas.xlsx"},
    )


@router.get("/orders/{order_id}/invoice")
async def export_invoice_pdf(order_id: int, db: AsyncSession = Depends(get_db)):
    from fpdf import FPDF
    o = await db.scalar(
        select(Order).where(Order.id == order_id).options(selectinload(Order.contact))
    )
    if not o:
        raise HTTPException(404, "Encomenda não encontrada")

    contact = o.contact
    items = o.items or []

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # Header
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 10, "FACTURA", ln=True)
    pdf.set_font("Helvetica", size=10)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 6, f"N.o #{o.id}", ln=True)
    pdf.cell(0, 6, f"Data: {o.created_at.strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(5)

    # Client
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 7, "Cliente", ln=True)
    pdf.set_font("Helvetica", size=10)
    pdf.set_text_color(55, 65, 81)
    if contact:
        pdf.cell(0, 6, contact.name or "—", ln=True)
        pdf.cell(0, 6, f"Tel: {contact.phone}", ln=True)
        if contact.address:
            pdf.cell(0, 6, contact.address, ln=True)
    pdf.ln(5)

    # Items table header
    pdf.set_fill_color(243, 244, 246)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(31, 41, 55)
    col_w = [90, 25, 35, 35]
    pdf.cell(col_w[0], 8, "Artigo", border=1, fill=True)
    pdf.cell(col_w[1], 8, "Qtd", border=1, fill=True, align="C")
    pdf.cell(col_w[2], 8, "P. Unit.", border=1, fill=True, align="R")
    pdf.cell(col_w[3], 8, "Total", border=1, fill=True, align="R")
    pdf.ln()

    pdf.set_font("Helvetica", size=10)
    pdf.set_text_color(55, 65, 81)
    for item in items:
        name = str(item.get("name", ""))[:45]
        qty = item.get("quantity", 1)
        price = float(item.get("unit_price", 0))
        total = qty * price
        pdf.cell(col_w[0], 7, name, border=1)
        pdf.cell(col_w[1], 7, str(qty), border=1, align="C")
        pdf.cell(col_w[2], 7, f"{price:,.0f}", border=1, align="R")
        pdf.cell(col_w[3], 7, f"{total:,.0f}", border=1, align="R")
        pdf.ln()

    # Total
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12)
    total_amount = float(o.total_amount) if o.total_amount else sum(
        float(i.get("unit_price", 0)) * float(i.get("quantity", 1)) for i in items
    )
    pdf.cell(col_w[0] + col_w[1] + col_w[2], 9, "TOTAL (AOA)", align="R")
    pdf.cell(col_w[3], 9, f"{total_amount:,.0f}", align="R", border=1)
    pdf.ln(10)

    # Payment info
    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 5, f"Metodo de pagamento: {o.payment_method.value}", ln=True)
    pdf.cell(0, 5, f"Estado do pagamento: {o.payment_status.value}", ln=True)
    if o.notes:
        pdf.cell(0, 5, f"Notas: {o.notes}", ln=True)

    buf = BytesIO(bytes(pdf.output()))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=factura_{o.id}.pdf"},
    )

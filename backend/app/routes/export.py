from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
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

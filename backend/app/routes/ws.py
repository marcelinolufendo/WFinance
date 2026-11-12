from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(ws: WebSocket, conversation_id: int):
    await manager.connect(ws, conversation_id)
    try:
        while True:
            await ws.receive_text()  # mantém a conexão aberta
    except WebSocketDisconnect:
        manager.disconnect(ws, conversation_id)

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = {}  # conversation_id → sockets
        self._global: list[WebSocket] = []  # listeners for global events

    async def connect(self, ws: WebSocket, conversation_id: int) -> None:
        await ws.accept()
        self._connections.setdefault(conversation_id, []).append(ws)

    def disconnect(self, ws: WebSocket, conversation_id: int) -> None:
        conns = self._connections.get(conversation_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, conversation_id: int, data: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self._connections.get(conversation_id, []):
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, conversation_id)

    async def connect_global(self, ws: WebSocket) -> None:
        await ws.accept()
        self._global.append(ws)

    def disconnect_global(self, ws: WebSocket) -> None:
        if ws in self._global:
            self._global.remove(ws)

    async def broadcast_global(self, data: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self._global:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_global(ws)


manager = ConnectionManager()

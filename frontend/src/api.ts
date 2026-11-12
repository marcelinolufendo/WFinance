import type { Conversation, Message } from "./types";

const BASE = "/api";

export async function fetchConversations(): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/conversations`);
  if (!r.ok) throw new Error("Erro ao carregar conversas");
  return r.json();
}

export async function fetchMessages(conversationId: number): Promise<Message[]> {
  const r = await fetch(`${BASE}/conversations/${conversationId}/messages`);
  if (!r.ok) throw new Error("Erro ao carregar mensagens");
  return r.json();
}

export async function sendMessage(conversationId: number, text: string): Promise<void> {
  const r = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? "Erro ao enviar mensagem");
  }
}

export function openWebSocket(conversationId: number, onMessage: (msg: Message) => void): WebSocket {
  const ws = new WebSocket(`/ws/${conversationId}`);
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as Message;
      onMessage(data);
    } catch {
      // ignorar mensagens malformadas
    }
  };
  return ws;
}

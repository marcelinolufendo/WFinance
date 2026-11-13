import type { Conversation, Message, Product, Service, Campaign } from "./types";

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

export async function suggestReply(conversationId: number): Promise<string> {
  const r = await fetch(`${BASE}/conversations/${conversationId}/suggest`, { method: "POST" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? "Erro ao gerar sugestão");
  }
  const data = await r.json();
  return data.suggestion as string;
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const r = await fetch(`${BASE}/products`);
  if (!r.ok) throw new Error("Erro ao carregar produtos");
  return r.json();
}

export async function createProduct(data: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
  const r = await fetch(`${BASE}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar produto");
  return r.json();
}

export async function updateProduct(id: number, data: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
  const r = await fetch(`${BASE}/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar produto");
  return r.json();
}

export async function deleteProduct(id: number): Promise<void> {
  await fetch(`${BASE}/products/${id}`, { method: "DELETE" });
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function fetchServices(): Promise<Service[]> {
  const r = await fetch(`${BASE}/services`);
  if (!r.ok) throw new Error("Erro ao carregar serviços");
  return r.json();
}

export async function createService(data: Omit<Service, "id" | "created_at" | "updated_at">): Promise<Service> {
  const r = await fetch(`${BASE}/services`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar serviço");
  return r.json();
}

export async function updateService(id: number, data: Omit<Service, "id" | "created_at" | "updated_at">): Promise<Service> {
  const r = await fetch(`${BASE}/services/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar serviço");
  return r.json();
}

export async function deleteService(id: number): Promise<void> {
  await fetch(`${BASE}/services/${id}`, { method: "DELETE" });
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function fetchCampaigns(): Promise<Campaign[]> {
  const r = await fetch(`${BASE}/campaigns`);
  if (!r.ok) throw new Error("Erro ao carregar campanhas");
  return r.json();
}

export async function createCampaign(data: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> {
  const r = await fetch(`${BASE}/campaigns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar campanha");
  return r.json();
}

export async function updateCampaign(id: number, data: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> {
  const r = await fetch(`${BASE}/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar campanha");
  return r.json();
}

export async function deleteCampaign(id: number): Promise<void> {
  await fetch(`${BASE}/campaigns/${id}`, { method: "DELETE" });
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

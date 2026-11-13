import type { Conversation, Message, Product, Service, Campaign, DashboardData, Order, OrderPayload, Delivery, Customer, BotConfig, KnowledgeEntry, QuickReply } from "./types";

const BASE = "/api";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function saveToken(token: string): void {
  localStorage.setItem("token", token);
}

export function clearToken(): void {
  localStorage.removeItem("token");
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const r = await fetch(url, { ...init, headers });
  if (r.status === 401) {
    clearToken();
    window.location.reload();
  }
  return r;
}

export async function login(username: string, password: string): Promise<{ token: string; username: string; is_admin: boolean }> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? "Credenciais inválidas");
  }
  return r.json();
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function fetchConversations(status?: string, mode?: string): Promise<Conversation[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (mode) params.set("mode", mode);
  const q = params.toString();
  const r = await apiFetch(`${BASE}/conversations${q ? `?${q}` : ""}`);
  if (!r.ok) throw new Error("Erro ao carregar conversas");
  return r.json();
}

export async function fetchMessages(conversationId: number): Promise<Message[]> {
  const r = await apiFetch(`${BASE}/conversations/${conversationId}/messages`);
  if (!r.ok) throw new Error("Erro ao carregar mensagens");
  return r.json();
}

export async function sendMessage(conversationId: number, text: string): Promise<void> {
  const r = await apiFetch(`${BASE}/conversations/${conversationId}/messages`, {
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
  const r = await apiFetch(`${BASE}/conversations/${conversationId}/suggest`, { method: "POST" });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? "Erro ao gerar sugestão");
  }
  const data = await r.json();
  return data.suggestion as string;
}

export async function toggleConversationMode(id: number): Promise<{ controlled_by: "human" | "bot" }> {
  const r = await apiFetch(`${BASE}/conversations/${id}/mode`, { method: "PATCH" });
  if (!r.ok) throw new Error("Erro ao mudar modo");
  return r.json();
}

export async function resolveConversation(id: number): Promise<{ resolved_at: string | null }> {
  const r = await apiFetch(`${BASE}/conversations/${id}/resolve`, { method: "PATCH" });
  if (!r.ok) throw new Error("Erro ao resolver conversa");
  return r.json();
}

export async function updateConversationNotes(id: number, internal_notes: string): Promise<void> {
  const r = await apiFetch(`${BASE}/conversations/${id}/notes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ internal_notes }),
  });
  if (!r.ok) throw new Error("Erro ao guardar notas");
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function fetchDashboard(): Promise<DashboardData> {
  const r = await apiFetch(`${BASE}/dashboard`);
  if (!r.ok) throw new Error("Erro ao carregar dashboard");
  return r.json();
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function fetchOrders(): Promise<Order[]> {
  const r = await apiFetch(`${BASE}/orders`);
  if (!r.ok) throw new Error("Erro ao carregar encomendas");
  return r.json();
}

export async function createOrder(data: OrderPayload): Promise<Order> {
  const r = await apiFetch(`${BASE}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar encomenda");
  return r.json();
}

export async function updateOrder(id: number, data: OrderPayload): Promise<Order> {
  const r = await apiFetch(`${BASE}/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar encomenda");
  return r.json();
}

export async function deleteOrder(id: number): Promise<void> {
  await apiFetch(`${BASE}/orders/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export async function fetchDeliveries(): Promise<Delivery[]> {
  const r = await apiFetch(`${BASE}/deliveries`);
  if (!r.ok) throw new Error("Erro ao carregar entregas");
  return r.json();
}

export async function createDelivery(orderId: number, data: Omit<Delivery, "id" | "order_id" | "delivered_at" | "created_at" | "updated_at" | "order">): Promise<Delivery> {
  const r = await apiFetch(`${BASE}/orders/${orderId}/delivery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar entrega");
  return r.json();
}

export async function updateDelivery(id: number, data: Omit<Delivery, "id" | "order_id" | "delivered_at" | "created_at" | "updated_at" | "order">): Promise<Delivery> {
  const r = await apiFetch(`${BASE}/deliveries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar entrega");
  return r.json();
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function fetchCustomers(): Promise<Customer[]> {
  const r = await apiFetch(`${BASE}/customers`);
  if (!r.ok) throw new Error("Erro ao carregar clientes");
  return r.json();
}

export async function createCustomer(data: { phone: string; name?: string | null; email?: string | null; address?: string | null; segment?: string; internal_notes?: string | null }): Promise<Customer> {
  const r = await apiFetch(`${BASE}/customers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? "Erro ao criar cliente");
  }
  return r.json();
}

export async function importCustomersCSV(file: File): Promise<{ created: number; skipped: number }> {
  const form = new FormData();
  form.append("file", file);
  const r = await apiFetch(`${BASE}/customers/import`, { method: "POST", body: form });
  if (!r.ok) throw new Error("Erro ao importar CSV");
  return r.json();
}

export async function updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
  const r = await apiFetch(`${BASE}/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar cliente");
  return r.json();
}

export async function fetchCustomerHistory(id: number): Promise<{ contact: object; orders: object[]; conversations: object[] }> {
  const r = await apiFetch(`${BASE}/customers/${id}/history`);
  if (!r.ok) throw new Error("Erro ao carregar histórico");
  return r.json();
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function fetchProducts(): Promise<Product[]> {
  const r = await apiFetch(`${BASE}/products`);
  if (!r.ok) throw new Error("Erro ao carregar produtos");
  return r.json();
}

export async function createProduct(data: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
  const r = await apiFetch(`${BASE}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar produto");
  return r.json();
}

export async function updateProduct(id: number, data: Omit<Product, "id" | "created_at" | "updated_at">): Promise<Product> {
  const r = await apiFetch(`${BASE}/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar produto");
  return r.json();
}

export async function deleteProduct(id: number): Promise<void> {
  await apiFetch(`${BASE}/products/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export async function fetchServices(): Promise<Service[]> {
  const r = await apiFetch(`${BASE}/services`);
  if (!r.ok) throw new Error("Erro ao carregar serviços");
  return r.json();
}

export async function createService(data: Omit<Service, "id" | "created_at" | "updated_at">): Promise<Service> {
  const r = await apiFetch(`${BASE}/services`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar serviço");
  return r.json();
}

export async function updateService(id: number, data: Omit<Service, "id" | "created_at" | "updated_at">): Promise<Service> {
  const r = await apiFetch(`${BASE}/services/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar serviço");
  return r.json();
}

export async function deleteService(id: number): Promise<void> {
  await apiFetch(`${BASE}/services/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function fetchCampaigns(): Promise<Campaign[]> {
  const r = await apiFetch(`${BASE}/campaigns`);
  if (!r.ok) throw new Error("Erro ao carregar campanhas");
  return r.json();
}

export async function createCampaign(data: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> {
  const r = await apiFetch(`${BASE}/campaigns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar campanha");
  return r.json();
}

export async function updateCampaign(id: number, data: Omit<Campaign, "id" | "created_at" | "updated_at">): Promise<Campaign> {
  const r = await apiFetch(`${BASE}/campaigns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar campanha");
  return r.json();
}

export async function deleteCampaign(id: number): Promise<void> {
  await apiFetch(`${BASE}/campaigns/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Bot Config & Knowledge
// ---------------------------------------------------------------------------

export async function fetchBotConfig(): Promise<BotConfig> {
  const r = await apiFetch(`${BASE}/bot/config`);
  if (!r.ok) throw new Error("Erro ao carregar config do bot");
  return r.json();
}

export async function saveBotConfig(data: BotConfig): Promise<BotConfig> {
  const r = await apiFetch(`${BASE}/bot/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao guardar config do bot");
  return r.json();
}

export async function fetchKnowledge(): Promise<KnowledgeEntry[]> {
  const r = await apiFetch(`${BASE}/knowledge-base`);
  if (!r.ok) throw new Error("Erro ao carregar knowledge base");
  return r.json();
}

export async function createKnowledge(data: Omit<KnowledgeEntry, "id" | "created_at" | "updated_at">): Promise<KnowledgeEntry> {
  const r = await apiFetch(`${BASE}/knowledge-base`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar entrada");
  return r.json();
}

export async function updateKnowledge(id: number, data: Omit<KnowledgeEntry, "id" | "created_at" | "updated_at">): Promise<KnowledgeEntry> {
  const r = await apiFetch(`${BASE}/knowledge-base/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao actualizar entrada");
  return r.json();
}

export async function deleteKnowledge(id: number): Promise<void> {
  await apiFetch(`${BASE}/knowledge-base/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Quick Replies
// ---------------------------------------------------------------------------

export async function fetchQuickReplies(): Promise<QuickReply[]> {
  const r = await apiFetch(`${BASE}/quick-replies`);
  if (!r.ok) throw new Error("Erro ao carregar respostas rápidas");
  return r.json();
}

export async function createQuickReply(data: { title: string; content: string }): Promise<QuickReply> {
  const r = await apiFetch(`${BASE}/quick-replies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar resposta rápida");
  return r.json();
}

export async function deleteQuickReply(id: number): Promise<void> {
  await apiFetch(`${BASE}/quick-replies/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function exportCustomersUrl(): string {
  return `${BASE}/export/customers`;
}

export function exportOrdersUrl(): string {
  return `${BASE}/export/orders`;
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

export type WsEvent =
  | (Message & { _ws: true })
  | { type: "typing"; value: boolean };

export function openWebSocket(
  conversationId: number,
  onMessage: (msg: Message) => void,
  onTyping?: (typing: boolean) => void,
): WebSocket {
  const ws = new WebSocket(`/ws/${conversationId}`);
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "typing" && onTyping) {
        onTyping(data.value as boolean);
      } else {
        onMessage(data as Message);
      }
    } catch {
      // ignorar mensagens malformadas
    }
  };
  return ws;
}

export type GlobalWsEvent = {
  type: "new_message";
  conversation_id: number;
  contact: { id: number; phone: string; name: string | null };
  controlled_by: "human" | "bot";
  preview: string;
  last_message_preview?: string;
  direction: "inbound" | "outbound";
};

export function openGlobalWebSocket(onEvent: (evt: GlobalWsEvent) => void): WebSocket {
  const ws = new WebSocket("/ws/global");
  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as GlobalWsEvent;
      onEvent(data);
    } catch {
      // ignorar
    }
  };
  return ws;
}

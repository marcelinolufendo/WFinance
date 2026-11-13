import type { Conversation, Message, Product, Service, Campaign, DashboardData, Order, OrderPayload, Delivery, Customer, BotConfig, KnowledgeEntry } from "./types";

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function toggleConversationMode(id: number): Promise<{ controlled_by: "human" | "bot" }> {
  const r = await fetch(`${BASE}/conversations/${id}/mode`, { method: "PATCH" });
  if (!r.ok) throw new Error("Erro ao mudar modo");
  return r.json();
}

export async function fetchDashboard(): Promise<DashboardData> {
  const r = await fetch(`${BASE}/dashboard`);
  if (!r.ok) throw new Error("Erro ao carregar dashboard");
  return r.json();
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function fetchOrders(): Promise<Order[]> {
  const r = await fetch(`${BASE}/orders`);
  if (!r.ok) throw new Error("Erro ao carregar encomendas");
  return r.json();
}

export async function createOrder(data: OrderPayload): Promise<Order> {
  const r = await fetch(`${BASE}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar encomenda");
  return r.json();
}

export async function updateOrder(id: number, data: OrderPayload): Promise<Order> {
  const r = await fetch(`${BASE}/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar encomenda");
  return r.json();
}

export async function deleteOrder(id: number): Promise<void> {
  await fetch(`${BASE}/orders/${id}`, { method: "DELETE" });
}

// ── Deliveries ────────────────────────────────────────────────────────────────

export async function fetchDeliveries(): Promise<Delivery[]> {
  const r = await fetch(`${BASE}/deliveries`);
  if (!r.ok) throw new Error("Erro ao carregar entregas");
  return r.json();
}

export async function createDelivery(orderId: number, data: Omit<Delivery, "id" | "order_id" | "delivered_at" | "created_at" | "updated_at" | "order">): Promise<Delivery> {
  const r = await fetch(`${BASE}/orders/${orderId}/delivery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar entrega");
  return r.json();
}

export async function updateDelivery(id: number, data: Omit<Delivery, "id" | "order_id" | "delivered_at" | "created_at" | "updated_at" | "order">): Promise<Delivery> {
  const r = await fetch(`${BASE}/deliveries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar entrega");
  return r.json();
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function fetchCustomers(): Promise<Customer[]> {
  const r = await fetch(`${BASE}/customers`);
  if (!r.ok) throw new Error("Erro ao carregar clientes");
  return r.json();
}

export async function updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
  const r = await fetch(`${BASE}/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao atualizar cliente");
  return r.json();
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

// ── Bot Config ────────────────────────────────────────────────────────────────

export async function fetchBotConfig(): Promise<BotConfig> {
  const r = await fetch(`${BASE}/bot/config`);
  if (!r.ok) throw new Error("Erro ao carregar config do bot");
  return r.json();
}

export async function saveBotConfig(data: BotConfig): Promise<BotConfig> {
  const r = await fetch(`${BASE}/bot/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao guardar config do bot");
  return r.json();
}

// ── Knowledge Base ────────────────────────────────────────────────────────────

export async function fetchKnowledge(): Promise<KnowledgeEntry[]> {
  const r = await fetch(`${BASE}/knowledge-base`);
  if (!r.ok) throw new Error("Erro ao carregar knowledge base");
  return r.json();
}

export async function createKnowledge(data: Omit<KnowledgeEntry, "id" | "created_at" | "updated_at">): Promise<KnowledgeEntry> {
  const r = await fetch(`${BASE}/knowledge-base`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao criar entrada");
  return r.json();
}

export async function updateKnowledge(id: number, data: Omit<KnowledgeEntry, "id" | "created_at" | "updated_at">): Promise<KnowledgeEntry> {
  const r = await fetch(`${BASE}/knowledge-base/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error("Erro ao actualizar entrada");
  return r.json();
}

export async function deleteKnowledge(id: number): Promise<void> {
  await fetch(`${BASE}/knowledge-base/${id}`, { method: "DELETE" });
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

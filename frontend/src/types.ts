export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  stock: number | null;
  stock_min: number | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  message_template: string | null;
  status: "draft" | "active" | "paused" | "ended";
  starts_at: string | null;
  ends_at: string | null;
  template_name: string | null;
  template_language: string | null;
  sent_count: number;
  target_segment: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  conversations: { total: number; open: number; new_today: number; new_week: number };
  messages: { today: number; inbound_today: number; outbound_today: number };
  orders: { total: number; pending: number; delivering: number; delivered_month: number };
  revenue: { month: number; total: number };
  deliveries: { today: number; pending: number; on_way: number };
  customers: { total: number; new_month: number };
  catalog: { products: number; services: number };
  orders_by_day: { date: string; orders: number; revenue: number }[];
}

export interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  product_id?: number | null;
}

export interface Order {
  id: number;
  contact: { id: number; name: string | null; phone: string } | null;
  conversation_id: number | null;
  status: "draft" | "confirmed" | "preparing" | "delivering" | "delivered" | "cancelled";
  payment_method: "cash" | "transfer" | "mobile_money" | "pending";
  payment_status: "unpaid" | "partial" | "paid";
  items: OrderItem[];
  total_amount: number | null;
  notes: string | null;
  return_status: "none" | "requested" | "approved" | "refunded" | "rejected";
  return_notes: string | null;
  delivery: Delivery | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface ReportData {
  avg_response_time_minutes: number | null;
  conversion_rate: number;
  top_words: { word: string; count: number }[];
  conversations_per_day: { date: string; count: number }[];
  orders_per_day: { date: string; orders: number; revenue: number }[];
  stock_alerts: { id: number; name: string; stock: number; stock_min: number }[];
  totals: { conversations: number; orders: number; revenue: number; customers: number };
}

export interface OrderPayload {
  contact_id: number;
  conversation_id?: number | null;
  status: Order["status"];
  payment_method: Order["payment_method"];
  payment_status: Order["payment_status"];
  items: OrderItem[];
  total_amount?: number | null;
  notes?: string | null;
}

export interface Delivery {
  id: number;
  order_id: number;
  status: "pending" | "on_way" | "delivered" | "failed";
  address: string | null;
  scheduled_at: string | null;
  delivered_at: string | null;
  driver_name: string | null;
  notes: string | null;
  order: { id: number; contact: { id: number; name: string | null; phone: string }; total_amount: number | null; status: string } | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  address: string | null;
  segment: "regular" | "vip" | "inactive" | "lead";
  internal_notes: string | null;
  conversation_count: number;
  order_count: number;
  total_spent: number;
  created_at: string;
}

export interface BotConfig {
  enabled: boolean;
  model: string;
  openrouter_api_key: string | null;
  tone: string;
  store_name: string;
  extra_instructions: string | null;
  auto_create_order: boolean;
}

export interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  category: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: number;
  phone: string;
  name: string | null;
}

export interface Conversation {
  id: number;
  contact: Contact;
  window_open: boolean;
  controlled_by: "human" | "bot";
  last_message_preview: string | null;
  resolved_at: string | null;
  internal_notes: string | null;
  updated_at: string;
}

export interface QuickReply {
  id: number;
  title: string;
  content: string;
}

export interface Message {
  id: number;
  wa_message_id: string;
  direction: "inbound" | "outbound";
  type: "text" | "audio" | "image" | "video" | "document";
  content: string | null;
  media_path: string | null;
  status: "received" | "sent" | "delivered" | "read" | "failed";
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  stock: number | null;
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
  updated_at: string;
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

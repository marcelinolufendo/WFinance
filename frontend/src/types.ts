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

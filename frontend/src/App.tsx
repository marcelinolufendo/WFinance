import { useEffect, useState } from "react";
import type { Conversation } from "./types";
import { fetchConversations } from "./api";
import { ConversationList } from "./components/ConversationList";
import { ChatWindow } from "./components/ChatWindow";
import { DashboardPage } from "./components/DashboardPage";
import { OrdersPage } from "./components/OrdersPage";
import { DeliveriesPage } from "./components/DeliveriesPage";
import { CustomersPage } from "./components/CustomersPage";
import { ProductsPage } from "./components/ProductsPage";
import { ServicesPage } from "./components/ServicesPage";
import { CampaignsPage } from "./components/CampaignsPage";
import { BotPage } from "./components/BotPage";

type Section = "dashboard" | "chat" | "orders" | "deliveries" | "customers" | "products" | "services" | "campaigns" | "bot";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "chat", label: "Conversas", icon: "💬" },
  { key: "orders", label: "Encomendas", icon: "🛒" },
  { key: "deliveries", label: "Entregas", icon: "🚚" },
  { key: "customers", label: "Clientes", icon: "👥" },
  { key: "products", label: "Produtos", icon: "📦" },
  { key: "services", label: "Serviços", icon: "🛠️" },
  { key: "campaigns", label: "Campanhas", icon: "📢" },
  { key: "bot", label: "Bot IA", icon: "🤖" },
];

export default function App() {
  const [section, setSection] = useState<Section>("dashboard");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchConversations().then(setConversations).catch(console.error);
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen font-sans text-gray-900">
      {/* Sidebar */}
      <nav className="w-16 bg-gray-900 flex flex-col items-center py-3 gap-0.5 shrink-0 overflow-y-auto">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            title={item.label}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
              section === item.key ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="leading-none" style={{ fontSize: "9px" }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Conteúdo */}
      {section === "chat" ? (
        <>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <main className="flex-1 flex flex-col">
            {selected ? (
              <ChatWindow conversation={selected} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Seleciona uma conversa
              </div>
            )}
          </main>
        </>
      ) : (
        <main className="flex-1 flex flex-col overflow-hidden">
          {section === "dashboard" && <DashboardPage />}
          {section === "orders" && <OrdersPage />}
          {section === "deliveries" && <DeliveriesPage />}
          {section === "customers" && <CustomersPage />}
          {section === "products" && <ProductsPage />}
          {section === "services" && <ServicesPage />}
          {section === "campaigns" && <CampaignsPage />}
          {section === "bot" && <BotPage />}
        </main>
      )}
    </div>
  );
}

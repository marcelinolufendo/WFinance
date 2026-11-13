import { useEffect, useState } from "react";
import type { Conversation } from "./types";
import { fetchConversations } from "./api";
import { ConversationList } from "./components/ConversationList";
import { ChatWindow } from "./components/ChatWindow";
import { ProductsPage } from "./components/ProductsPage";
import { ServicesPage } from "./components/ServicesPage";
import { CampaignsPage } from "./components/CampaignsPage";

type Section = "chat" | "products" | "services" | "campaigns";

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: "chat", label: "Conversas", icon: "💬" },
  { key: "products", label: "Produtos", icon: "📦" },
  { key: "services", label: "Serviços", icon: "🛠️" },
  { key: "campaigns", label: "Campanhas", icon: "📢" },
];

export default function App() {
  const [section, setSection] = useState<Section>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchConversations().then(setConversations).catch(console.error);
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen font-sans text-gray-900">
      {/* Sidebar de navegação */}
      <nav className="w-16 bg-gray-900 flex flex-col items-center py-4 gap-1 shrink-0">
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            title={item.label}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs gap-0.5 transition-colors ${
              section === item.key ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="leading-none" style={{ fontSize: "9px" }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Conteúdo principal */}
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
          {section === "products" && <ProductsPage />}
          {section === "services" && <ServicesPage />}
          {section === "campaigns" && <CampaignsPage />}
        </main>
      )}
    </div>
  );
}

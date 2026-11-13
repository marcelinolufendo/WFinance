import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation } from "./types";
import { fetchConversations, openGlobalWebSocket, getToken, clearToken } from "./api";
import type { GlobalWsEvent } from "./api";
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
import { LoginPage } from "./components/LoginPage";

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

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // browser sem suporte a AudioContext
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [convFilter, setConvFilter] = useState<{ status: string; mode: string }>({ status: "open", mode: "" });
  const selectedIdRef = useRef<number | null>(null);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!loggedIn) return;
    fetchConversations(convFilter.status || undefined, convFilter.mode || undefined)
      .then(setConversations)
      .catch(console.error);
  }, [loggedIn, convFilter]);

  const handleGlobalEvent = useCallback((evt: GlobalWsEvent) => {
    if (evt.type !== "new_message") return;
    const { conversation_id, contact, controlled_by, preview } = evt;

    setConversations(prev => {
      const existing = prev.find(c => c.id === conversation_id);
      const updated: Conversation = existing
        ? {
            ...existing,
            contact: { ...existing.contact, ...contact },
            controlled_by,
            last_message_preview: evt.last_message_preview ?? preview ?? null,
          }
        : {
            id: conversation_id,
            contact: { id: contact.id, phone: contact.phone, name: contact.name },
            controlled_by,
            window_open: true,
            last_message_preview: evt.last_message_preview ?? preview ?? null,
            resolved_at: null,
            internal_notes: null,
            updated_at: new Date().toISOString(),
          };
      const without = prev.filter(c => c.id !== conversation_id);
      return [updated, ...without];
    });

    if (evt.direction === "inbound" && selectedIdRef.current !== conversation_id) {
      setUnread(prev => ({ ...prev, [conversation_id]: (prev[conversation_id] ?? 0) + 1 }));
      playBeep();
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const ws = openGlobalWebSocket(handleGlobalEvent);
    return () => ws.close();
  }, [loggedIn, handleGlobalEvent]);

  function selectConversation(id: number) {
    setSelectedId(id);
    setUnread(prev => ({ ...prev, [id]: 0 }));
    if (section !== "chat") setSection("chat");
  }

  function handleLogin(username: string) {
    setCurrentUser(username);
    setLoggedIn(true);
  }

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
    setCurrentUser(null);
    setSelectedId(null);
    setConversations([]);
  }

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0);

  return (
    <div className="flex h-screen font-sans text-gray-900">
      {/* Sidebar */}
      <nav className="w-16 bg-gray-900 flex flex-col items-center py-3 gap-0.5 shrink-0 overflow-y-auto">
        {NAV.map((item) => {
          const badgeCount = item.key === "chat" ? totalUnread : 0;
          return (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              title={item.label}
              className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                section === item.key ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="leading-none" style={{ fontSize: "9px" }}>{item.label}</span>
              {badgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Logout */}
        <div className="mt-auto">
          <button
            onClick={handleLogout}
            title={`Sair (${currentUser})`}
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span className="text-lg leading-none">🚪</span>
            <span className="leading-none" style={{ fontSize: "9px" }}>Sair</span>
          </button>
        </div>
      </nav>

      {/* Conteúdo */}
      {section === "chat" ? (
        <>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={selectConversation}
            unread={unread}
            filter={convFilter}
            onFilterChange={setConvFilter}
          />
          <main className="flex-1 flex flex-col">
            {selected ? (
              <ChatWindow
                conversation={selected}
                onConversationUpdate={(updated) =>
                  setConversations(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
                }
              />
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

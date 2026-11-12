import { useEffect, useState } from "react";
import type { Conversation } from "./types";
import { fetchConversations } from "./api";
import { ConversationList } from "./components/ConversationList";
import { ChatWindow } from "./components/ChatWindow";

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchConversations().then(setConversations).catch(console.error);
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen font-sans text-gray-900">
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
    </div>
  );
}

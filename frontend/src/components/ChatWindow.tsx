import { useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "../types";
import { fetchMessages, sendMessage, openWebSocket } from "../api";
import { MediaMessage } from "./MediaMessage";

interface Props {
  conversation: Conversation;
}

const STATUS_ICON: Record<string, string> = {
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
  failed: "✗",
};

export function ChatWindow({ conversation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(conversation.id).then(setMessages).catch(console.error);

    const ws = openWebSocket(conversation.id, (msg) => {
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === msg.id);
        if (exists) return prev.map((m) => (m.id === msg.id ? msg : m));
        return [...prev, msg];
      });
    });

    return () => ws.close();
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!text.trim()) return;
    setError(null);
    setSending(true);
    try {
      await sendMessage(conversation.id, text.trim());
      setText("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <p className="font-semibold">{conversation.contact.name ?? conversation.contact.phone}</p>
          <p className="text-xs text-gray-400">{conversation.contact.phone}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${conversation.window_open ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
          {conversation.window_open ? "Janela aberta" : "Janela encerrada"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${m.direction === "outbound" ? "bg-green-500 text-white rounded-br-sm" : "bg-white shadow rounded-bl-sm"}`}>
              {m.type === "text" ? (
                <p>{m.content}</p>
              ) : (
                <MediaMessage type={m.type} mediaPath={m.media_path} content={m.content} />
              )}
              {m.direction === "outbound" && (
                <span className={`text-[10px] ml-1 ${m.status === "read" ? "text-blue-200" : "text-green-200"}`}>
                  {STATUS_ICON[m.status] ?? ""}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {error && <p className="px-4 py-1 text-xs text-red-600 bg-red-50">{error}</p>}
      <div className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          placeholder={conversation.window_open ? "Escreve uma mensagem..." : "Janela encerrada — use um template"}
          disabled={!conversation.window_open || sending}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!conversation.window_open || sending || !text.trim()}
          className="bg-green-500 text-white px-4 py-2 rounded-full text-sm disabled:opacity-50 hover:bg-green-600"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { Conversation, Message, OrderPayload, QuickReply } from "../types";
import {
  fetchMessages, sendMessage, openWebSocket, suggestReply, createOrder,
  toggleConversationMode, resolveConversation, updateConversationNotes, fetchQuickReplies,
} from "../api";
import { MediaMessage } from "./MediaMessage";

interface Props {
  conversation: Conversation;
  onModeChange?: (id: number, mode: string) => void;
  onConversationUpdate?: (updated: Partial<Conversation> & { id: number }) => void;
}

const STATUS_ICON: Record<string, string> = {
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
  failed: "✗",
};

export function ChatWindow({ conversation, onModeChange, onConversationUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [mode, setMode] = useState(conversation.controlled_by);
  const [resolved, setResolved] = useState(!!conversation.resolved_at);
  const [orderModal, setOrderModal] = useState(false);
  const [orderItems, setOrderItems] = useState([{ name: "", quantity: 1, unit_price: 0 }]);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderSaving, setOrderSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(conversation.internal_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQR, setShowQR] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(conversation.controlled_by);
    setResolved(!!conversation.resolved_at);
    setNotes(conversation.internal_notes ?? "");
  }, [conversation.id]);

  useEffect(() => {
    fetchMessages(conversation.id).then(setMessages).catch(console.error);
    fetchQuickReplies().then(setQuickReplies).catch(console.error);

    const ws = openWebSocket(
      conversation.id,
      (msg) => {
        setMessages((prev) => {
          const exists = prev.find((m) => m.id === msg.id);
          if (exists) return prev.map((m) => (m.id === msg.id ? msg : m));
          return [...prev, msg];
        });
      },
      (typing) => setBotTyping(typing),
    );

    return () => ws.close();
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, botTyping]);

  async function handleSend() {
    if (!text.trim()) return;
    setError(null);
    setSending(true);
    setSuggestion(null);
    setShowQR(false);
    try {
      await sendMessage(conversation.id, text.trim());
      setText("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSending(false);
    }
  }

  async function handleSuggest() {
    setSuggestion(null);
    setError(null);
    setSuggesting(true);
    try {
      const s = await suggestReply(conversation.id);
      setSuggestion(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao gerar sugestão");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleToggleMode() {
    setToggling(true);
    try {
      const r = await toggleConversationMode(conversation.id);
      setMode(r.controlled_by);
      onModeChange?.(conversation.id, r.controlled_by);
    } finally { setToggling(false); }
  }

  async function handleResolve() {
    try {
      const r = await resolveConversation(conversation.id);
      const newResolved = !!r.resolved_at;
      setResolved(newResolved);
      onConversationUpdate?.({ id: conversation.id, resolved_at: r.resolved_at });
    } catch {}
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await updateConversationNotes(conversation.id, notes);
      onConversationUpdate?.({ id: conversation.id, internal_notes: notes });
      setShowNotes(false);
    } finally { setSavingNotes(false); }
  }

  async function handleCreateOrder() {
    setOrderSaving(true);
    try {
      const payload: OrderPayload = {
        contact_id: conversation.contact.id,
        conversation_id: conversation.id,
        status: "draft",
        payment_method: "pending",
        payment_status: "unpaid",
        items: orderItems.filter(i => i.name.trim()),
        total_amount: orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0) || null,
        notes: orderNotes || null,
      };
      await createOrder(payload);
      setOrderModal(false);
      setOrderItems([{ name: "", quantity: 1, unit_price: 0 }]);
      setOrderNotes("");
    } finally { setOrderSaving(false); }
  }

  function useSuggestion() {
    if (suggestion) { setText(suggestion); setSuggestion(null); }
  }

  return (
    <div className="flex flex-col flex-1 h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold">{conversation.contact.name ?? conversation.contact.phone}</p>
          <p className="text-xs text-gray-400">{conversation.contact.phone}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className={`text-xs px-2 py-0.5 rounded-full ${conversation.window_open ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
            {conversation.window_open ? "Janela aberta" : "Janela encerrada"}
          </span>
          <button
            onClick={handleToggleMode}
            disabled={toggling}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${mode === "bot" ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            {toggling ? "…" : mode === "bot" ? "🤖 Bot" : "👤 Humano"}
          </button>
          <button onClick={handleResolve} className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${resolved ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {resolved ? "✅ Resolvida" : "Resolver"}
          </button>
          <button onClick={() => setShowNotes(!showNotes)} className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200 font-medium">
            📝 Notas
          </button>
          <button onClick={() => setOrderModal(true)} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 font-medium">
            🛒 Encomenda
          </button>
        </div>
      </div>

      {/* Internal notes panel */}
      {showNotes && (
        <div className="border-b bg-yellow-50 p-3">
          <p className="text-xs font-semibold text-yellow-800 mb-1">Notas internas (não visíveis pelo cliente)</p>
          <textarea
            className="w-full border border-yellow-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adiciona notas sobre esta conversa..."
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => setShowNotes(false)} className="text-xs text-gray-500 px-3 py-1 rounded border hover:bg-gray-100">Cancelar</button>
            <button onClick={handleSaveNotes} disabled={savingNotes} className="text-xs bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 disabled:opacity-50">
              {savingNotes ? "A guardar…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

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

        {/* Typing indicator */}
        {botTyping && (
          <div className="flex justify-start">
            <div className="bg-white shadow rounded-2xl rounded-bl-sm px-4 py-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion card */}
      {suggestion && (
        <div className="mx-3 mb-1 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <p className="text-xs text-blue-500 font-semibold mb-1">✦ Sugestão do assistente</p>
          <p className="text-gray-800 leading-snug">{suggestion}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={useSuggestion} className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full hover:bg-blue-600">Usar</button>
            <button onClick={() => { setText(suggestion); setSuggestion(null); }} className="border border-blue-300 text-blue-600 text-xs px-3 py-1 rounded-full hover:bg-blue-100">Editar</button>
            <button onClick={() => setSuggestion(null)} className="text-gray-400 text-xs px-2 py-1 hover:text-gray-600">Descartar</button>
          </div>
        </div>
      )}

      {/* Quick replies dropdown */}
      {showQR && quickReplies.length > 0 && (
        <div className="mx-3 mb-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          <p className="text-xs text-gray-500 font-semibold px-3 pt-2 pb-1">Respostas rápidas</p>
          {quickReplies.map((qr) => (
            <button
              key={qr.id}
              onClick={() => { setText(qr.content); setShowQR(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-t first:border-t-0"
            >
              <span className="font-medium text-gray-700">{qr.title}</span>
              <span className="text-gray-400 ml-2 text-xs truncate">{qr.content.substring(0, 50)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {error && <p className="px-4 py-1 text-xs text-red-600 bg-red-50">{error}</p>}
      <div className="p-3 border-t flex gap-2 items-center">
        <button
          onClick={handleSuggest}
          disabled={!conversation.window_open || suggesting}
          title="Sugerir resposta com IA"
          className="text-blue-500 border border-blue-300 px-3 py-2 rounded-full text-sm disabled:opacity-40 hover:bg-blue-50 flex items-center gap-1 shrink-0"
        >
          {suggesting ? "…" : "✦"}
        </button>
        {quickReplies.length > 0 && (
          <button
            onClick={() => setShowQR(!showQR)}
            title="Respostas rápidas"
            className="text-purple-500 border border-purple-300 px-3 py-2 rounded-full text-sm hover:bg-purple-50 shrink-0"
          >
            ⚡
          </button>
        )}
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

      {/* Order modal */}
      {orderModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-1">Nova encomenda</h2>
            <p className="text-sm text-gray-400 mb-4">{conversation.contact.name ?? conversation.contact.phone}</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-600">Artigos</span>
                  <button onClick={() => setOrderItems([...orderItems, { name: "", quantity: 1, unit_price: 0 }])} className="text-xs text-blue-600 hover:underline">+ Adicionar</button>
                </div>
                {orderItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <input className="input text-xs col-span-5" placeholder="Nome do artigo" value={item.name} onChange={e => { const a = [...orderItems]; a[idx] = { ...a[idx], name: e.target.value }; setOrderItems(a); }} />
                    <input type="number" className="input text-xs col-span-2" placeholder="Qtd" min={1} value={item.quantity} onChange={e => { const a = [...orderItems]; a[idx] = { ...a[idx], quantity: +e.target.value }; setOrderItems(a); }} />
                    <input type="number" className="input text-xs col-span-4" placeholder="Preço" min={0} value={item.unit_price} onChange={e => { const a = [...orderItems]; a[idx] = { ...a[idx], unit_price: +e.target.value }; setOrderItems(a); }} />
                    <button className="col-span-1 text-red-400 text-sm" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} disabled={orderItems.length === 1}>×</button>
                  </div>
                ))}
                <p className="text-right text-sm font-semibold text-gray-700">
                  Total: {orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString("pt-AO")} AOA
                </p>
              </div>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Notas</span>
                <textarea className="input" rows={2} value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setOrderModal(false)} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={handleCreateOrder} disabled={orderSaving || !orderItems.some(i => i.name.trim())} className="bg-amber-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {orderSaving ? "A criar…" : "Criar encomenda"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

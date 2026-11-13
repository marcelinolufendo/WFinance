import { useState } from "react";
import type { Conversation } from "../types";

interface Filter {
  status: string;
  mode: string;
}

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  unread?: Record<number, number>;
  filter?: Filter;
  onFilterChange?: (f: Filter) => void;
}

export function ConversationList({ conversations, selectedId, onSelect, unread = {}, filter, onFilterChange }: Props) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.contact.name ?? "").toLowerCase().includes(q) || c.contact.phone.includes(q);
  });

  function setStatus(s: string) { onFilterChange?.({ ...filter!, status: s }); }
  function setMode(m: string) { onFilterChange?.({ ...filter!, mode: m }); }

  return (
    <aside className="w-72 border-r border-gray-200 flex flex-col bg-white">
      {/* Header + search */}
      <div className="p-3 border-b">
        <p className="font-semibold text-gray-700 mb-2 text-sm">Conversas</p>
        <input
          type="text"
          placeholder="Pesquisar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-green-400 bg-gray-50"
        />
      </div>

      {/* Filters */}
      {filter && onFilterChange && (
        <div className="px-3 py-2 border-b flex gap-1 flex-wrap">
          {["open", "resolved", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filter.status === s ? "bg-green-600 text-white border-green-600" : "text-gray-500 border-gray-200 hover:bg-gray-100"}`}
            >
              {s === "open" ? "Abertas" : s === "resolved" ? "Resolvidas" : "Todas"}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-0.5" />
          {["", "bot", "human"].map((m) => (
            <button
              key={m || "all"}
              onClick={() => setMode(m)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filter.mode === m ? "bg-indigo-600 text-white border-indigo-600" : "text-gray-500 border-gray-200 hover:bg-gray-100"}`}
            >
              {m === "bot" ? "🤖 Bot" : m === "human" ? "👤 Humano" : "Todos"}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">Nenhuma conversa encontrada</p>
        )}
        {filtered.map((c) => {
          const badge = unread[c.id] ?? 0;
          const isSelected = selectedId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 transition-colors ${
                isSelected ? "bg-green-50 border-l-4 border-l-green-500" : ""
              } ${c.resolved_at ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${badge > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                    {c.contact.name ?? c.contact.phone}
                    {c.resolved_at && <span className="ml-1 text-[10px] text-green-600">✅</span>}
                  </p>
                  {c.last_message_preview ? (
                    <p className="text-xs text-gray-400 truncate">{c.last_message_preview}</p>
                  ) : (
                    <p className="text-xs text-gray-400">{c.contact.phone}</p>
                  )}
                  {!c.window_open && !c.resolved_at && (
                    <span className="text-[10px] text-orange-500">Janela encerrada</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {badge > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {c.controlled_by === "bot" && (
                    <span className="text-[9px] text-indigo-500">🤖</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

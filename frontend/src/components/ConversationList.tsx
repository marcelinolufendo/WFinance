import type { Conversation } from "../types";

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  unread?: Record<number, number>;
}

export function ConversationList({ conversations, selectedId, onSelect, unread = {} }: Props) {
  return (
    <aside className="w-72 border-r border-gray-200 flex flex-col overflow-y-auto">
      <div className="p-4 font-semibold text-gray-700 border-b">Conversas</div>
      {conversations.map((c) => {
        const badge = unread[c.id] ?? 0;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`text-left p-4 hover:bg-gray-50 border-b border-gray-100 ${
              selectedId === c.id ? "bg-green-50 border-l-4 border-l-green-500" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`font-medium text-gray-800 ${badge > 0 ? "font-semibold" : ""}`}>
                {c.contact.name ?? c.contact.phone}
              </p>
              {badge > 0 && (
                <span className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{c.contact.phone}</p>
            {!c.window_open && (
              <span className="text-xs text-orange-500">Janela encerrada</span>
            )}
          </button>
        );
      })}
    </aside>
  );
}

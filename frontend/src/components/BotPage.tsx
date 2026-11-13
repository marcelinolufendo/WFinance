import { useEffect, useState } from "react";
import { fetchBotConfig, saveBotConfig, fetchKnowledge, createKnowledge, updateKnowledge, deleteKnowledge } from "../api";
import type { BotConfig, KnowledgeEntry } from "../types";

const CAT_LABELS: Record<string, string> = {
  delivery: "Entregas", payment: "Pagamentos", schedule: "Horários",
  policy: "Políticas", faq: "Perguntas frequentes", other: "Outras",
};
const CATS = Object.keys(CAT_LABELS);
const TONES = [{ value: "friendly", label: "Amigável" }, { value: "formal", label: "Formal" }, { value: "casual", label: "Casual" }];
const MODELS = [
  { id: "google/gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (recomendado)" },
  { id: "google/gemini-flash-1.5", label: "Gemini 1.5 Flash" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
  { id: "anthropic/claude-haiku-3-5", label: "Claude 3.5 Haiku" },
  { id: "mistralai/mistral-nemo", label: "Mistral Nemo" },
];

type Tab = "config" | "knowledge";

export function BotPage() {
  const [tab, setTab] = useState<Tab>("config");
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [configForm, setConfigForm] = useState<BotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: KnowledgeEntry | null }>({ open: false, editing: null });
  const [kbForm, setKbForm] = useState({ title: "", content: "", category: "faq", active: true });
  const [kbLoading, setKbLoading] = useState(false);

  useEffect(() => {
    fetchBotConfig().then(c => { setConfig(c); setConfigForm(c); }).catch(console.error);
    fetchKnowledge().then(setKnowledge).catch(console.error);
  }, []);

  async function saveConfig() {
    if (!configForm) return;
    setSaving(true);
    try {
      const saved = await saveBotConfig(configForm);
      setConfig(saved);
      setConfigForm(saved);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } finally { setSaving(false); }
  }

  function openCreate() {
    setKbForm({ title: "", content: "", category: "faq", active: true });
    setModal({ open: true, editing: null });
  }

  function openEdit(e: KnowledgeEntry) {
    setKbForm({ title: e.title, content: e.content, category: e.category, active: e.active });
    setModal({ open: true, editing: e });
  }

  async function saveKb() {
    setKbLoading(true);
    try {
      if (modal.editing) await updateKnowledge(modal.editing.id, kbForm);
      else await createKnowledge(kbForm);
      setModal({ open: false, editing: null });
      setKnowledge(await fetchKnowledge());
    } finally { setKbLoading(false); }
  }

  async function removeKb(id: number) {
    if (!confirm("Eliminar esta entrada?")) return;
    await deleteKnowledge(id);
    setKnowledge(await fetchKnowledge());
  }

  const grouped = CATS.reduce((acc, cat) => {
    acc[cat] = knowledge.filter(k => k.category === cat);
    return acc;
  }, {} as Record<string, KnowledgeEntry[]>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-0 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              🤖 Bot de Atendimento
              {config?.enabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Activo</span>}
              {config && !config.enabled && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Inactivo</span>}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Configura o bot e a base de conhecimento</p>
          </div>
        </div>
        <div className="flex gap-1">
          {(["config", "knowledge"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-t-lg font-medium transition-colors ${tab === t ? "bg-white border border-b-white text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {t === "config" ? "Configuração" : `Base de Conhecimento (${knowledge.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* CONFIG TAB */}
        {tab === "config" && configForm && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center justify-between p-4 border rounded-xl">
              <div>
                <p className="font-medium">Bot activado</p>
                <p className="text-sm text-gray-400">Quando activo, responde automaticamente nas conversas em modo "bot"</p>
              </div>
              <button onClick={() => setConfigForm({ ...configForm, enabled: !configForm.enabled })}
                className={`w-12 h-6 rounded-full transition-colors relative ${configForm.enabled ? "bg-green-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configForm.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">Nome da loja</span>
              <input className="input" value={configForm.store_name} onChange={e => setConfigForm({ ...configForm, store_name: e.target.value })} />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">Modelo</span>
                <select className="input" value={configForm.model} onChange={e => setConfigForm({ ...configForm, model: e.target.value })}>
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">Tom de voz</span>
                <select className="input" value={configForm.tone} onChange={e => setConfigForm({ ...configForm, tone: e.target.value })}>
                  {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">OpenRouter API Key</span>
              <input type="password" className="input" placeholder={configForm.openrouter_api_key ? "••••••••• (guardada)" : "sk-or-..."} onChange={e => setConfigForm({ ...configForm, openrouter_api_key: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">Obtém em <span className="text-blue-500">openrouter.ai/keys</span></p>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">Instruções adicionais</span>
              <textarea className="input" rows={4} placeholder="Ex: Nunca mencionar concorrentes. Sempre perguntar o nome do cliente..." value={configForm.extra_instructions ?? ""} onChange={e => setConfigForm({ ...configForm, extra_instructions: e.target.value })} />
            </label>

            <div className="flex items-center justify-between p-4 border rounded-xl">
              <div>
                <p className="font-medium">Criar encomenda automática</p>
                <p className="text-sm text-gray-400">Quando o bot detecta uma encomenda, cria-a automaticamente em rascunho</p>
              </div>
              <button onClick={() => setConfigForm({ ...configForm, auto_create_order: !configForm.auto_create_order })}
                className={`w-12 h-6 rounded-full transition-colors relative ${configForm.auto_create_order ? "bg-green-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${configForm.auto_create_order ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>

            <button onClick={saveConfig} disabled={saving}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${configSaved ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-gray-700"} disabled:opacity-50`}>
              {saving ? "A guardar…" : configSaved ? "✓ Guardado" : "Guardar configuração"}
            </button>
          </div>
        )}

        {/* KNOWLEDGE TAB */}
        {tab === "knowledge" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">+ Nova entrada</button>
            </div>

            {CATS.filter(cat => grouped[cat]?.length > 0).map(cat => (
              <div key={cat} className="mb-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{CAT_LABELS[cat]}</h2>
                <div className="space-y-2">
                  {grouped[cat].map(e => (
                    <div key={e.id} className={`border rounded-lg p-4 ${!e.active ? "opacity-50" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 mr-4">
                          <p className="font-medium text-sm">{e.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{e.content}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => openEdit(e)} className="text-blue-600 hover:underline text-xs">Editar</button>
                          <button onClick={() => removeKb(e.id)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {knowledge.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">📚</p>
                <p>Base de conhecimento vazia</p>
                <p className="text-sm">Adiciona informações sobre entregas, pagamentos, horários...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">{modal.editing ? "Editar entrada" : "Nova entrada"}</h2>
            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Categoria</span>
                <select className="input" value={kbForm.category} onChange={e => setKbForm({ ...kbForm, category: e.target.value })}>
                  {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Título</span>
                <input className="input" value={kbForm.title} onChange={e => setKbForm({ ...kbForm, title: e.target.value })} placeholder="Ex: Taxa de entrega" />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Conteúdo</span>
                <textarea className="input" rows={4} value={kbForm.content} onChange={e => setKbForm({ ...kbForm, content: e.target.value })} placeholder="Informação que o bot deve saber e partilhar com os clientes..." />
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={kbForm.active} onChange={e => setKbForm({ ...kbForm, active: e.target.checked })} />
                Activo
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={saveKb} disabled={kbLoading || !kbForm.title || !kbForm.content}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {kbLoading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import type { Campaign } from "../types";
import { fetchCampaigns, createCampaign, updateCampaign, deleteCampaign } from "../api";

type Status = Campaign["status"];

const STATUS_LABELS: Record<Status, string> = { draft: "Rascunho", active: "Ativa", paused: "Pausada", ended: "Terminada" };
const STATUS_COLORS: Record<Status, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  ended: "bg-red-100 text-red-600",
};

const EMPTY: Omit<Campaign, "id" | "created_at" | "updated_at"> = {
  name: "",
  description: "",
  message_template: "",
  status: "draft",
  starts_at: null,
  ends_at: null,
};

export function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Campaign | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() { setItems(await fetchCampaigns()); }

  function openCreate() { setForm({ ...EMPTY }); setModal({ open: true, editing: null }); }

  function openEdit(c: Campaign) {
    setForm({
      name: c.name,
      description: c.description ?? "",
      message_template: c.message_template ?? "",
      status: c.status,
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : null,
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : null,
    });
    setModal({ open: true, editing: c });
  }

  async function save() {
    setLoading(true);
    try {
      const payload = {
        ...form,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      if (modal.editing) await updateCampaign(modal.editing.id, payload);
      else await createCampaign(payload);
      setModal({ open: false, editing: null });
      await load();
    } finally { setLoading(false); }
  }

  async function remove(id: number) {
    if (!confirm("Eliminar campanha?")) return;
    await deleteCampaign(id);
    await load();
  }

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Campanhas Publicitárias</h1>
        <button onClick={openCreate} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm">+ Nova campanha</button>
      </div>

      <div className="grid gap-4">
        {items.length === 0 && <p className="text-center text-gray-400 py-8">Sem campanhas</p>}
        {items.map((c) => (
          <div key={c.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </div>
                {c.description && <p className="text-sm text-gray-500 mb-2">{c.description}</p>}
                {c.message_template && (
                  <div className="bg-gray-50 rounded p-2 text-sm text-gray-700 border-l-2 border-purple-300 mb-2">
                    {c.message_template}
                  </div>
                )}
                <div className="text-xs text-gray-400 flex gap-4">
                  {c.starts_at && <span>Início: {new Date(c.starts_at).toLocaleDateString("pt-AO")}</span>}
                  {c.ends_at && <span>Fim: {new Date(c.ends_at).toLocaleDateString("pt-AO")}</span>}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-sm">Editar</button>
                <button onClick={() => remove(c.id)} className="text-red-500 hover:underline text-sm">Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{modal.editing ? "Editar campanha" : "Nova campanha"}</h2>
            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Nome *</span>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Descrição</span>
                <textarea className="input" rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Mensagem da campanha</span>
                <textarea className="input" rows={4} placeholder="Texto que será enviado aos clientes…" value={form.message_template ?? ""} onChange={(e) => setForm({ ...form, message_template: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Estado</span>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                  <option value="ended">Terminada</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Data de início</span>
                  <input type="datetime-local" className="input" value={form.starts_at ?? ""} onChange={(e) => setForm({ ...form, starts_at: e.target.value || null })} />
                </label>
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Data de fim</span>
                  <input type="datetime-local" className="input" value={form.ends_at ?? ""} onChange={(e) => setForm({ ...form, ends_at: e.target.value || null })} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={save} disabled={loading || !form.name} className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

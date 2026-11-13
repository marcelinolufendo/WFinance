import { useEffect, useState } from "react";
import type { Service } from "../types";
import { fetchServices, createService, updateService, deleteService } from "../api";

const EMPTY: Omit<Service, "id" | "created_at" | "updated_at"> = {
  name: "",
  description: "",
  price: null,
  duration_minutes: null,
  status: "active",
};

export function ServicesPage() {
  const [items, setItems] = useState<Service[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Service | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() { setItems(await fetchServices()); }

  function openCreate() { setForm({ ...EMPTY }); setModal({ open: true, editing: null }); }

  function openEdit(s: Service) {
    setForm({ name: s.name, description: s.description ?? "", price: s.price, duration_minutes: s.duration_minutes, status: s.status });
    setModal({ open: true, editing: s });
  }

  async function save() {
    setLoading(true);
    try {
      if (modal.editing) await updateService(modal.editing.id, form);
      else await createService(form);
      setModal({ open: false, editing: null });
      await load();
    } finally { setLoading(false); }
  }

  async function remove(id: number) {
    if (!confirm("Eliminar serviço?")) return;
    await deleteService(id);
    await load();
  }

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Serviços</h1>
        <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">+ Novo serviço</button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3 border">Nome</th>
            <th className="p-3 border">Preço (AOA)</th>
            <th className="p-3 border">Duração</th>
            <th className="p-3 border">Estado</th>
            <th className="p-3 border">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-gray-400">Sem serviços</td></tr>
          )}
          {items.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="p-3 border font-medium">{s.name}</td>
              <td className="p-3 border">{s.price != null ? s.price.toLocaleString("pt-AO") : "—"}</td>
              <td className="p-3 border">{s.duration_minutes != null ? `${s.duration_minutes} min` : "—"}</td>
              <td className="p-3 border">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.status === "active" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
                  {s.status === "active" ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td className="p-3 border space-x-2">
                <button onClick={() => openEdit(s)} className="text-blue-600 hover:underline">Editar</button>
                <button onClick={() => remove(s.id)} className="text-red-500 hover:underline">Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{modal.editing ? "Editar serviço" : "Novo serviço"}</h2>
            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Nome *</span>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Descrição</span>
                <textarea className="input" rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Preço (AOA)</span>
                  <input type="number" className="input" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value ? +e.target.value : null })} />
                </label>
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Duração (min)</span>
                  <input type="number" className="input" value={form.duration_minutes ?? ""} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value ? +e.target.value : null })} />
                </label>
              </div>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Estado</span>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={save} disabled={loading || !form.name} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

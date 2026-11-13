import { useEffect, useState } from "react";
import type { Customer } from "../types";
import { fetchCustomers, updateCustomer } from "../api";

const SEGMENT_LABELS: Record<string, string> = { regular: "Regular", vip: "VIP", inactive: "Inativo", lead: "Lead" };
const SEGMENT_COLORS: Record<string, string> = {
  regular: "bg-gray-100 text-gray-600",
  vip: "bg-yellow-100 text-yellow-700",
  inactive: "bg-red-100 text-red-500",
  lead: "bg-blue-100 text-blue-700",
};

type EditForm = { name: string; email: string; address: string; segment: string; internal_notes: string };

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [modal, setModal] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [form, setForm] = useState<EditForm>({ name: "", email: "", address: "", segment: "regular", internal_notes: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() { setCustomers(await fetchCustomers()); }

  function openEdit(c: Customer) {
    setForm({ name: c.name ?? "", email: c.email ?? "", address: c.address ?? "", segment: c.segment, internal_notes: c.internal_notes ?? "" });
    setModal({ open: true, customer: c });
  }

  async function save() {
    if (!modal.customer) return;
    setLoading(true);
    try {
      await updateCustomer(modal.customer.id, { ...form, segment: form.segment as any, name: form.name || null, email: form.email || null, address: form.address || null, internal_notes: form.internal_notes || null });
      setModal({ open: false, customer: null });
      await load();
    } finally { setLoading(false); }
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.name ?? "").toLowerCase().includes(q) || c.phone.includes(q) || (c.email ?? "").toLowerCase().includes(q);
    const matchSegment = segmentFilter === "all" || c.segment === segmentFilter;
    return matchSearch && matchSegment;
  });

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <div className="flex gap-2">
          <input className="input text-sm w-48" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input text-sm w-auto" value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="lead">Leads</option>
            <option value="regular">Regulares</option>
            <option value="vip">VIP</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3 border">Nome / Telefone</th>
            <th className="p-3 border">Segmento</th>
            <th className="p-3 border">Encomendas</th>
            <th className="p-3 border">Gasto total</th>
            <th className="p-3 border">Desde</th>
            <th className="p-3 border">Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-gray-400">Sem clientes</td></tr>}
          {filtered.map(c => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="p-3 border">
                <div className="font-medium">{c.name ?? "—"}</div>
                <div className="text-gray-400 text-xs">{c.phone}</div>
                {c.email && <div className="text-gray-400 text-xs">{c.email}</div>}
              </td>
              <td className="p-3 border">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SEGMENT_COLORS[c.segment]}`}>{SEGMENT_LABELS[c.segment]}</span>
              </td>
              <td className="p-3 border text-center">{c.order_count}</td>
              <td className="p-3 border font-medium">{c.total_spent > 0 ? `${c.total_spent.toLocaleString("pt-AO")} AOA` : "—"}</td>
              <td className="p-3 border text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString("pt-AO")}</td>
              <td className="p-3 border">
                <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline">Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal.open && modal.customer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Editar cliente</h2>
            <p className="text-sm text-gray-400 mb-4">{modal.customer.phone}</p>
            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Nome</span>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Email</span>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Morada</span>
                <textarea className="input" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Segmento</span>
                <select className="input" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                  <option value="lead">Lead</option>
                  <option value="regular">Regular</option>
                  <option value="vip">VIP</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Notas internas</span>
                <textarea className="input" rows={3} placeholder="Apenas visível pela equipa..." value={form.internal_notes} onChange={e => setForm({ ...form, internal_notes: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, customer: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={save} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { Customer } from "../types";
import { fetchCustomers, updateCustomer, createCustomer, importCustomersCSV, fetchCustomerHistory, exportCustomers } from "../api";

const SEGMENT_LABELS: Record<string, string> = { regular: "Regular", vip: "VIP", inactive: "Inativo", lead: "Lead" };
const SEGMENT_COLORS: Record<string, string> = {
  regular: "bg-gray-100 text-gray-600",
  vip: "bg-yellow-100 text-yellow-700",
  inactive: "bg-red-100 text-red-500",
  lead: "bg-blue-100 text-blue-700",
};

type EditForm = { name: string; email: string; address: string; segment: string; internal_notes: string };
type CreateForm = { phone: string; name: string; email: string; address: string; segment: string; internal_notes: string };

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [modal, setModal] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState<EditForm>({ name: "", email: "", address: "", segment: "regular", internal_notes: "" });
  const [createForm, setCreateForm] = useState<CreateForm>({ phone: "", name: "", email: "", address: "", segment: "regular", internal_notes: "" });
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const [historyModal, setHistoryModal] = useState<{ open: boolean; customer: Customer | null; data: any | null }>({ open: false, customer: null, data: null });
  const csvInputRef = useRef<HTMLInputElement>(null);

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

  async function saveCreate() {
    if (!createForm.phone.trim()) return;
    setLoading(true);
    try {
      await createCustomer({ ...createForm, name: createForm.name || null, email: createForm.email || null, address: createForm.address || null, internal_notes: createForm.internal_notes || null });
      setCreateModal(false);
      setCreateForm({ phone: "", name: "", email: "", address: "", segment: "regular", internal_notes: "" });
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally { setLoading(false); }
  }

  async function openHistory(c: Customer) {
    setHistoryModal({ open: true, customer: c, data: null });
    try {
      const data = await fetchCustomerHistory(c.id);
      setHistoryModal(prev => ({ ...prev, data }));
    } catch {}
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importCustomersCSV(file);
      setImportResult(result);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
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
        <div className="flex gap-2 flex-wrap">
          <input className="input text-sm w-48" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input text-sm w-auto" value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="lead">Leads</option>
            <option value="regular">Regulares</option>
            <option value="vip">VIP</option>
            <option value="inactive">Inativos</option>
          </select>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => csvInputRef.current?.click()} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">Importar CSV</button>
          <button onClick={() => exportCustomers().catch(e => alert(e.message))} className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50">📥 Excel</button>
          <button onClick={() => setCreateModal(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">+ Novo</button>
        </div>
      </div>
      {importResult && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700 flex items-center justify-between">
          <span>Importação concluída: <strong>{importResult.created}</strong> criados, <strong>{importResult.skipped}</strong> ignorados.</span>
          <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700 ml-4">✕</button>
        </div>
      )}

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
                <div className="flex gap-2">
                  <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs">Editar</button>
                  <button onClick={() => openHistory(c)} className="text-gray-500 hover:underline text-xs">Histórico</button>
                </div>
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

      {/* History Modal */}
      {historyModal.open && historyModal.customer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Histórico do cliente</h2>
                <p className="text-sm text-gray-400">{historyModal.customer.name ?? historyModal.customer.phone}</p>
              </div>
              <button onClick={() => setHistoryModal({ open: false, customer: null, data: null })} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {!historyModal.data ? (
              <p className="text-sm text-gray-400 text-center py-8">A carregar...</p>
            ) : (
              <div className="overflow-y-auto space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Encomendas ({historyModal.data.orders.length})</h3>
                  {historyModal.data.orders.length === 0 ? (
                    <p className="text-xs text-gray-400">Sem encomendas</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-gray-50"><th className="p-2 border text-left">ID</th><th className="p-2 border text-left">Estado</th><th className="p-2 border text-left">Artigos</th><th className="p-2 border text-right">Total</th><th className="p-2 border text-left">Data</th></tr></thead>
                      <tbody>
                        {historyModal.data.orders.map((o: any) => (
                          <tr key={o.id} className="hover:bg-gray-50">
                            <td className="p-2 border">#{o.id}</td>
                            <td className="p-2 border">{o.status}</td>
                            <td className="p-2 border text-center">{o.items_count}</td>
                            <td className="p-2 border text-right">{o.total_amount != null ? `${o.total_amount.toLocaleString("pt-AO")} AOA` : "—"}</td>
                            <td className="p-2 border text-gray-400">{new Date(o.created_at).toLocaleDateString("pt-AO")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Conversas ({historyModal.data.conversations.length})</h3>
                  {historyModal.data.conversations.length === 0 ? (
                    <p className="text-xs text-gray-400">Sem conversas</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-gray-50"><th className="p-2 border text-left">ID</th><th className="p-2 border text-left">Modo</th><th className="p-2 border text-left">Última mensagem</th><th className="p-2 border text-left">Estado</th><th className="p-2 border text-left">Data</th></tr></thead>
                      <tbody>
                        {historyModal.data.conversations.map((cv: any) => (
                          <tr key={cv.id} className="hover:bg-gray-50">
                            <td className="p-2 border">#{cv.id}</td>
                            <td className="p-2 border">{cv.controlled_by === "bot" ? "🤖 Bot" : "👤 Humano"}</td>
                            <td className="p-2 border text-gray-500 truncate max-w-xs">{cv.last_message_preview ?? "—"}</td>
                            <td className="p-2 border">{cv.resolved_at ? "✅ Resolvida" : "Aberta"}</td>
                            <td className="p-2 border text-gray-400">{new Date(cv.created_at).toLocaleDateString("pt-AO")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Novo contacto</h2>
            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Telefone *</span>
                <input className="input" placeholder="244912345678" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Nome</span>
                <input className="input" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Email</span>
                <input type="email" className="input" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Morada</span>
                <textarea className="input" rows={2} value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Segmento</span>
                <select className="input" value={createForm.segment} onChange={e => setCreateForm({ ...createForm, segment: e.target.value })}>
                  <option value="lead">Lead</option>
                  <option value="regular">Regular</option>
                  <option value="vip">VIP</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Notas internas</span>
                <textarea className="input" rows={2} placeholder="Apenas visível pela equipa..." value={createForm.internal_notes} onChange={e => setCreateForm({ ...createForm, internal_notes: e.target.value })} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">Para CSV: colunas <code>phone,name,email,address,segment,notes</code></p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={saveCreate} disabled={loading || !createForm.phone.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A criar…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

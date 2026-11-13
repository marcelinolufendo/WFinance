import { useEffect, useState } from "react";
import type { Delivery } from "../types";
import { fetchDeliveries, createDelivery, updateDelivery } from "../api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", on_way: "A caminho", delivered: "Entregue", failed: "Falhou",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  on_way: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

type DeliveryForm = {
  order_id: number;
  address: string;
  scheduled_at: string;
  driver_name: string;
  notes: string;
  status: string;
};

const EMPTY: DeliveryForm = { order_id: 0, address: "", scheduled_at: "", driver_name: "", notes: "", status: "pending" };

export function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Delivery | null; orderId?: number }>({ open: false, editing: null });
  const [form, setForm] = useState<DeliveryForm>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { load(); }, []);

  async function load() { setDeliveries(await fetchDeliveries()); }

  function openCreate(orderId?: number) {
    setForm({ ...EMPTY, order_id: orderId ?? 0 });
    setModal({ open: true, editing: null, orderId });
  }

  function openEdit(d: Delivery) {
    setForm({
      order_id: d.order_id,
      address: d.address ?? "",
      scheduled_at: d.scheduled_at ? d.scheduled_at.slice(0, 16) : "",
      driver_name: d.driver_name ?? "",
      notes: d.notes ?? "",
      status: d.status,
    });
    setModal({ open: true, editing: d });
  }

  async function save() {
    setLoading(true);
    try {
      const payload = {
        address: form.address || null,
        contact_name: (form as any).contact_name || null,
        contact_phone: (form as any).contact_phone || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        driver_name: form.driver_name || null,
        notes: form.notes || null,
        status: form.status as any,
      };
      if (modal.editing) await updateDelivery(modal.editing.id, payload);
      else await createDelivery(form.order_id, payload);
      setModal({ open: false, editing: null });
      await load();
    } finally { setLoading(false); }
  }

  const filtered = filter === "all" ? deliveries : deliveries.filter(d => d.status === filter);

  // Group by date for calendar-like view
  const groups: Record<string, Delivery[]> = {};
  filtered.forEach(d => {
    const key = d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString("pt-AO") : "Sem data";
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Entregas</h1>
        <div className="flex gap-2">
          <select className="input text-sm w-auto" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="on_way">A caminho</option>
            <option value="delivered">Entregues</option>
            <option value="failed">Falhadas</option>
          </select>
          <button onClick={() => openCreate()} className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 text-sm">+ Nova entrega</button>
        </div>
      </div>

      {Object.keys(groups).length === 0 && <p className="text-center text-gray-400 py-8">Sem entregas</p>}

      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <span className="w-6 h-px bg-gray-200 inline-block" />{date}<span className="flex-1 h-px bg-gray-200 inline-block" />
          </h2>
          <div className="space-y-2">
            {items.map(d => (
              <div key={d.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">Encomenda #{d.order_id}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                      {d.order?.total_amount != null && <span className="text-sm font-medium text-gray-700">{d.order.total_amount.toLocaleString("pt-AO")} AOA</span>}
                    </div>
                    {d.order?.contact && <p className="text-sm text-gray-600">{d.order.contact.name ?? d.order.contact.phone}</p>}
                    {d.address && <p className="text-sm text-gray-500">📍 {d.address}</p>}
                    {d.driver_name && <p className="text-sm text-gray-500">🚗 {d.driver_name}</p>}
                    {d.scheduled_at && <p className="text-xs text-gray-400">🕐 {new Date(d.scheduled_at).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}</p>}
                    {d.notes && <p className="text-xs text-gray-400 italic mt-1">{d.notes}</p>}
                  </div>
                  <button onClick={() => openEdit(d)} className="text-blue-600 hover:underline text-sm ml-4">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{modal.editing ? "Editar entrega" : "Nova entrega"}</h2>
            <div className="space-y-3">
              {!modal.editing && (
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">ID da Encomenda *</span>
                  <input type="number" className="input" placeholder="ex: 1" value={form.order_id || ""} onChange={e => setForm({ ...form, order_id: +e.target.value })} />
                </label>
              )}
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Morada de entrega</span>
                <textarea className="input" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Data/hora</span>
                  <input type="datetime-local" className="input" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
                </label>
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Estado</span>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="pending">Pendente</option>
                    <option value="on_way">A caminho</option>
                    <option value="delivered">Entregue</option>
                    <option value="failed">Falhou</option>
                  </select>
                </label>
              </div>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Estafeta</span>
                <input className="input" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} />
              </label>
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Notas</span>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={save} disabled={loading || (!modal.editing && !form.order_id)} className="bg-orange-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

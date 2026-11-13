import { useEffect, useState } from "react";
import type { Order, Customer, Product, Service } from "../types";
import { fetchOrders, createOrder, updateOrder, deleteOrder, fetchCustomers, fetchProducts, fetchServices } from "../api";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", confirmed: "Confirmada", preparing: "Em preparação",
  delivering: "Em entrega", delivered: "Entregue", cancelled: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-yellow-100 text-yellow-700", delivering: "bg-orange-100 text-orange-700",
  delivered: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-600",
};
const STATUSES = ["draft", "confirmed", "preparing", "delivering", "delivered", "cancelled"];

type ItemForm = { name: string; quantity: number; unit_price: number; product_id: number | null };

const EMPTY_ITEM: ItemForm = { name: "", quantity: 1, unit_price: 0, product_id: null };

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Order | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ contact_id: 0, status: "draft", payment_method: "pending", payment_status: "unpaid", notes: "", items: [{ ...EMPTY_ITEM }] as ItemForm[] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
    fetchCustomers().then(setCustomers).catch(console.error);
    fetchProducts().then(setProducts).catch(console.error);
    fetchServices().then(setServices).catch(console.error);
  }, []);

  async function load() { setOrders(await fetchOrders()); }

  function openCreate() {
    setForm({ contact_id: 0, status: "draft", payment_method: "pending", payment_status: "unpaid", notes: "", items: [{ ...EMPTY_ITEM }] });
    setModal({ open: true, editing: null });
  }

  function openEdit(o: Order) {
    setForm({
      contact_id: o.contact?.id ?? 0,
      status: o.status,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      notes: o.notes ?? "",
      items: o.items.length ? o.items.map(i => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price, product_id: i.product_id ?? null })) : [{ ...EMPTY_ITEM }],
    });
    setModal({ open: true, editing: o });
  }

  function calcTotal() { return form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0); }

  function setItem(idx: number, field: keyof ItemForm, value: string | number | null) {
    const items = form.items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    setForm({ ...form, items });
  }

  function addItem() { setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] }); }
  function removeItem(idx: number) { setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); }

  function pickProduct(idx: number, productId: string) {
    const pid = parseInt(productId);
    const p = products.find(p => p.id === pid);
    const s = services.find(s => s.id === pid - 10000);
    const item = p
      ? { name: p.name, quantity: 1, unit_price: p.price ?? 0, product_id: p.id }
      : s ? { name: s.name, quantity: 1, unit_price: s.price ?? 0, product_id: null }
      : form.items[idx];
    const items = form.items.map((it, i) => i === idx ? item : it);
    setForm({ ...form, items });
  }

  async function save() {
    setLoading(true);
    try {
      const payload = { contact_id: form.contact_id, status: form.status as any, payment_method: form.payment_method as any, payment_status: form.payment_status as any, notes: form.notes || null, items: form.items, total_amount: calcTotal() || null };
      if (modal.editing) await updateOrder(modal.editing.id, payload);
      else await createOrder(payload);
      setModal({ open: false, editing: null });
      await load();
    } finally { setLoading(false); }
  }

  async function remove(id: number) {
    if (!confirm("Eliminar encomenda?")) return;
    await deleteOrder(id);
    await load();
  }

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Encomendas</h1>
        <button onClick={openCreate} className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 text-sm">+ Nova encomenda</button>
      </div>

      <div className="space-y-3">
        {orders.length === 0 && <p className="text-center text-gray-400 py-8">Sem encomendas</p>}
        {orders.map(o => (
          <div key={o.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm">#{o.id}</span>
                  <span className="font-medium">{o.contact?.name ?? o.contact?.phone ?? "—"}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  {o.payment_status === "paid" && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Pago</span>}
                  {o.payment_status === "unpaid" && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-600">Por pagar</span>}
                </div>
                <div className="text-sm text-gray-500 mb-1">
                  {o.items.length} {o.items.length === 1 ? "artigo" : "artigos"}
                  {o.total_amount != null && <> · <span className="font-semibold text-gray-700">{o.total_amount.toLocaleString("pt-AO")} AOA</span></>}
                </div>
                {o.items.slice(0, 3).map((item, i) => (
                  <span key={i} className="text-xs text-gray-400 mr-2">{item.quantity}× {item.name}</span>
                ))}
                {o.notes && <p className="text-xs text-gray-400 mt-1 italic">{o.notes}</p>}
                <p className="text-xs text-gray-300 mt-1">{new Date(o.created_at).toLocaleDateString("pt-AO")}</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => openEdit(o)} className="text-blue-600 hover:underline text-sm">Editar</button>
                <button onClick={() => remove(o.id)} className="text-red-500 hover:underline text-sm">Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4">{modal.editing ? "Editar encomenda" : "Nova encomenda"}</h2>

            <div className="space-y-3">
              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Cliente *</span>
                <select className="input" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: +e.target.value })}>
                  <option value={0}>Selecionar cliente...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name ?? c.phone} ({c.phone})</option>)}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Estado</span>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </label>
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Pagamento</span>
                  <select className="input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                    <option value="pending">Pendente</option>
                    <option value="cash">Dinheiro</option>
                    <option value="transfer">Transferência</option>
                    <option value="mobile_money">Multicaixa Express</option>
                  </select>
                </label>
                <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Estado pagamento</span>
                  <select className="input" value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                    <option value="unpaid">Por pagar</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Pago</option>
                  </select>
                </label>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Artigos</span>
                  <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Adicionar artigo</button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select className="input text-xs" onChange={e => pickProduct(idx, e.target.value)} defaultValue="">
                          <option value="">Produto/serviço</option>
                          {products.map(p => <option key={p.id} value={p.id}>📦 {p.name}</option>)}
                          {services.map(s => <option key={s.id + 10000} value={s.id + 10000}>🛠 {s.name}</option>)}
                        </select>
                        <input className="input text-xs mt-1" placeholder="Nome do artigo" value={item.name} onChange={e => setItem(idx, "name", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" className="input text-xs" placeholder="Qtd" min={0.1} step={0.1} value={item.quantity} onChange={e => setItem(idx, "quantity", +e.target.value)} />
                      </div>
                      <div className="col-span-4">
                        <input type="number" className="input text-xs" placeholder="Preço unit." min={0} value={item.unit_price} onChange={e => setItem(idx, "unit_price", +e.target.value)} />
                      </div>
                      <div className="col-span-1 text-center">
                        {form.items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm">×</button>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-2 text-sm font-semibold text-gray-700">
                  Total: {calcTotal().toLocaleString("pt-AO")} AOA
                </div>
              </div>

              <label className="block"><span className="text-xs font-medium text-gray-600 mb-1 block">Notas</span>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={save} disabled={loading || !form.contact_id} className="bg-amber-500 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

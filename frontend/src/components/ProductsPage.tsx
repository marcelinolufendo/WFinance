import { useEffect, useState } from "react";
import type { Product } from "../types";
import { fetchProducts, createProduct, updateProduct, deleteProduct } from "../api";

const EMPTY: Omit<Product, "id" | "created_at" | "updated_at"> = {
  name: "",
  description: "",
  price: null,
  stock: null,
  status: "active",
};

export function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Product | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setItems(await fetchProducts());
  }

  function openCreate() {
    setForm({ ...EMPTY });
    setModal({ open: true, editing: null });
  }

  function openEdit(p: Product) {
    setForm({ name: p.name, description: p.description ?? "", price: p.price, stock: p.stock, status: p.status });
    setModal({ open: true, editing: p });
  }

  async function save() {
    setLoading(true);
    try {
      if (modal.editing) {
        await updateProduct(modal.editing.id, form);
      } else {
        await createProduct(form);
      }
      setModal({ open: false, editing: null });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Eliminar produto?")) return;
    await deleteProduct(id);
    await load();
  }

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Produtos</h1>
        <button onClick={openCreate} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm">
          + Novo produto
        </button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3 border">Nome</th>
            <th className="p-3 border">Preço (AOA)</th>
            <th className="p-3 border">Stock</th>
            <th className="p-3 border">Estado</th>
            <th className="p-3 border">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-gray-400">Sem produtos</td></tr>
          )}
          {items.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50">
              <td className="p-3 border font-medium">{p.name}</td>
              <td className="p-3 border">{p.price != null ? p.price.toLocaleString("pt-AO") : "—"}</td>
              <td className="p-3 border">{p.stock ?? "—"}</td>
              <td className="p-3 border">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                  {p.status === "active" ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td className="p-3 border space-x-2">
                <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline">Editar</button>
                <button onClick={() => remove(p.id)} className="text-red-500 hover:underline">Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{modal.editing ? "Editar produto" : "Novo produto"}</h2>
            <div className="space-y-3">
              <Field label="Nome *">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Descrição">
                <textarea className="input" rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (AOA)">
                  <input type="number" className="input" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value ? +e.target.value : null })} />
                </Field>
                <Field label="Stock">
                  <input type="number" className="input" value={form.stock ?? ""} onChange={(e) => setForm({ ...form, stock: e.target.value ? +e.target.value : null })} />
                </Field>
              </div>
              <Field label="Estado">
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded border text-sm">Cancelar</button>
              <button onClick={save} disabled={loading || !form.name} className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

import { useEffect, useState } from "react";
import { fetchDashboard } from "../api";
import type { DashboardData } from "../types";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
    const t = setInterval(() => fetchDashboard().then(setData).catch(console.error), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400">A carregar...</div>;
  if (!data) return <div className="flex-1 flex items-center justify-center text-gray-400">Sem dados</div>;

  const maxOrders = Math.max(...data.orders_by_day.map(d => d.orders), 1);
  const maxRevenue = Math.max(...data.orders_by_day.map(d => d.revenue), 1);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-xs text-gray-400">Atualiza a cada 30s</span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Conversas abertas" value={data.conversations.open} sub={`+${data.conversations.new_today} hoje`} color="blue" />
        <KpiCard label="Encomendas pendentes" value={data.orders.pending} sub={`${data.orders.delivering} em entrega`} color="amber" />
        <KpiCard label="Receita do mês" value={`${data.revenue.month.toLocaleString("pt-AO")} AOA`} sub={`${data.orders.delivered_month} encomendas`} color="green" />
        <KpiCard label="Entregas hoje" value={data.deliveries.today} sub={`${data.deliveries.on_way} a caminho`} color="purple" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total clientes" value={data.customers.total} sub={`+${data.customers.new_month} este mês`} color="gray" />
        <KpiCard label="Mensagens hoje" value={data.messages.today} sub={`${data.messages.inbound_today} recebidas`} color="gray" />
        <KpiCard label="Produtos" value={data.catalog.products} sub={`${data.catalog.services} serviços`} color="gray" />
        <KpiCard label="Receita total" value={`${data.revenue.total.toLocaleString("pt-AO")} AOA`} sub={`${data.orders.total} encomendas`} color="gray" />
      </div>

      {/* Chart + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart: encomendas últimos 7 dias */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Encomendas — últimos 7 dias</h2>
          <div className="flex items-end gap-2 h-32">
            {data.orders_by_day.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${Math.max(4, (d.orders / maxOrders) * 100)}px` }}
                  title={`${d.orders} encomendas`}
                />
                <span className="text-xs text-gray-400">{d.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart: receita últimos 7 dias */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Receita entregue — últimos 7 dias</h2>
          <div className="flex items-end gap-2 h-32">
            {data.orders_by_day.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-green-500 rounded-t"
                  style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}px` }}
                  title={`${d.revenue.toLocaleString("pt-AO")} AOA`}
                />
                <span className="text-xs text-gray-400">{d.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatusCard title="Conversas" items={[
          { label: "Total", value: data.conversations.total, color: "bg-gray-200" },
          { label: "Abertas (24h)", value: data.conversations.open, color: "bg-blue-400" },
          { label: "Novas hoje", value: data.conversations.new_today, color: "bg-blue-200" },
          { label: "Esta semana", value: data.conversations.new_week, color: "bg-blue-100" },
        ]} />
        <StatusCard title="Encomendas" items={[
          { label: "Rascunho / Confirmadas", value: data.orders.pending, color: "bg-amber-400" },
          { label: "Em entrega", value: data.orders.delivering, color: "bg-orange-400" },
          { label: "Entregues este mês", value: data.orders.delivered_month, color: "bg-green-400" },
          { label: "Total", value: data.orders.total, color: "bg-gray-200" },
        ]} />
        <StatusCard title="Entregas" items={[
          { label: "Agendadas para hoje", value: data.deliveries.today, color: "bg-purple-300" },
          { label: "Pendentes", value: data.deliveries.pending, color: "bg-amber-300" },
          { label: "A caminho", value: data.deliveries.on_way, color: "bg-green-400" },
        ]} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    amber: "bg-amber-50 border-amber-200",
    purple: "bg-purple-50 border-purple-200",
    gray: "bg-gray-50 border-gray-200",
  };
  const txt: Record<string, string> = {
    blue: "text-blue-600",
    green: "text-green-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
    gray: "text-gray-700",
  };
  return (
    <div className={`border rounded-lg p-4 ${bg[color] ?? bg.gray}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${txt[color] ?? txt.gray}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function StatusCard({ title, items }: { title: string; items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-600 mb-3">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-sm text-gray-600">{item.label}</span>
            </div>
            <span className="text-sm font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

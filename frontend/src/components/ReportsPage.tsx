import { useEffect, useState } from "react";
import { fetchReports } from "../api";
import type { ReportData } from "../types";

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">A carregar relatórios...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!data) return null;

  const fmtMin = (m: number | null) => {
    if (m === null) return "—";
    if (m < 60) return `${Math.round(m)} min`;
    return `${(m / 60).toFixed(1)} h`;
  };

  const maxConvDay = Math.max(...data.conversations_per_day.map((d) => d.count), 1);
  const maxRev = Math.max(...data.orders_per_day.map((d) => d.revenue), 1);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <h2 className="text-xl font-bold text-gray-800">Relatórios e Análise</h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Conversas" value={data.totals.conversations} />
        <KpiCard label="Encomendas" value={data.totals.orders} />
        <KpiCard label="Receita total" value={`${data.totals.revenue.toLocaleString("pt-AO")} Kz`} />
        <KpiCard label="Clientes" value={data.totals.customers} />
      </div>

      {/* Métricas de desempenho */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Tempo médio de resposta</p>
          <p className="text-3xl font-bold text-indigo-600">{fmtMin(data.avg_response_time_minutes)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Taxa de conversão</p>
          <p className="text-3xl font-bold text-green-600">{(data.conversion_rate * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">conversas que geraram encomenda</p>
        </div>
      </div>

      {/* Conversas por dia */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-3">Conversas por dia (últimos 30 dias)</h3>
        <div className="flex items-end gap-1 h-32 overflow-x-auto">
          {data.conversations_per_day.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1 min-w-[14px]">
              <div
                className="w-full bg-indigo-500 rounded-t"
                style={{ height: `${(d.count / maxConvDay) * 112}px` }}
                title={`${d.date}: ${d.count}`}
              />
              <span className="text-[8px] text-gray-400 rotate-45 origin-left">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Receita por dia */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-3">Receita por dia (últimos 30 dias)</h3>
        <div className="flex items-end gap-1 h-32 overflow-x-auto">
          {data.orders_per_day.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1 min-w-[14px]">
              <div
                className="w-full bg-green-500 rounded-t"
                style={{ height: `${(d.revenue / maxRev) * 112}px` }}
                title={`${d.date}: ${d.revenue.toLocaleString("pt-AO")} Kz (${d.orders} enc.)`}
              />
              <span className="text-[8px] text-gray-400 rotate-45 origin-left">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Palavras mais usadas */}
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">Palavras mais usadas pelos clientes</h3>
          {data.top_words.length === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados suficientes</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.top_words.map((w) => (
                <span
                  key={w.word}
                  className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-sm"
                  title={`${w.count} vezes`}
                >
                  {w.word} <span className="text-indigo-400 text-xs">({w.count})</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Alertas de stock */}
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">⚠️ Alertas de stock baixo</h3>
          {data.stock_alerts.length === 0 ? (
            <p className="text-green-600 text-sm">Todos os produtos têm stock suficiente</p>
          ) : (
            <div className="space-y-2">
              {data.stock_alerts.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">{p.name}</span>
                  <span className="text-sm text-orange-600 font-semibold">
                    {p.stock} / mín {p.stock_min}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

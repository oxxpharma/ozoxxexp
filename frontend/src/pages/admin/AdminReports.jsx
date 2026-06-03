import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { Download } from "lucide-react";
import { statusLabel, methodLabel, genderLabel } from "../../lib/labels";

function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const [tab, setTab] = useState("sales");
  const [sales, setSales] = useState(null);
  const [utm, setUtm] = useState([]);
  const [abandoned, setAbandoned] = useState([]);
  const [profile, setProfile] = useState(null);
  const [methods, setMethods] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get("/admin/analytics/sales-summary").then((r) => setSales(r.data));
    api.get("/admin/analytics/utm-sources").then((r) => setUtm(r.data));
    api.get("/admin/analytics/abandoned-carts").then((r) => setAbandoned(r.data));
    api.get("/admin/analytics/customer-profile").then((r) => setProfile(r.data));
    api.get("/admin/analytics/payment-methods").then((r) => setMethods(r.data));
    api.get("/admin/orders").then((r) => setOrders(r.data));
  }, []);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Análise</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Relatórios</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 mb-6 flex-wrap">
          <TabsTrigger value="sales">Vendas</TabsTrigger>
          <TabsTrigger value="utm">Marketing (UTM)</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="profile">Clientes</TabsTrigger>
          <TabsTrigger value="abandoned">Abandonos</TabsTrigger>
          <TabsTrigger value="orders">Pedidos (export)</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-3xl p-6">
              <h3 className="font-display text-xl mb-4">Por status</h3>
              {sales?.by_status?.map((s) => (
                <div key={s._id} className="flex justify-between py-2 border-b border-white/5 text-sm">
                  <span>{statusLabel(s._id)}</span><span className="text-ozx-primary">{s.count} · R$ {Number(s.total).toFixed(2)}</span>
                </div>
              )) || <p className="text-ozx-muted text-sm">Carregando...</p>}
            </div>
            <div className="glass-card rounded-3xl p-6">
              <h3 className="font-display text-xl mb-4">Por lote</h3>
              {sales?.by_lot?.map((l, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-white/5 text-sm">
                  <span>{l.lot_name}</span><span className="text-ozx-success">{l.tickets} ingressos · R$ {Number(l.revenue).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="utm">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex justify-end p-3 border-b border-white/5"><Button size="sm" variant="outline" className="border-white/15" onClick={() => downloadCSV("utm-report.csv", utm)}><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button></div>
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-ozx-muted"><tr><th className="text-left px-4 py-3">Origem</th><th className="text-left px-4 py-3">Meio</th><th className="text-left px-4 py-3">Campanha</th><th className="text-right px-4 py-3">Visitas</th><th className="text-right px-4 py-3">Pedidos</th><th className="text-right px-4 py-3">Pagos</th><th className="text-right px-4 py-3">Receita</th></tr></thead>
              <tbody>
                {utm.map((u, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-4 py-2">{u.source}</td><td className="px-4 py-2">{u.medium}</td><td className="px-4 py-2">{u.campaign}</td>
                    <td className="px-4 py-2 text-right">{u.visits}</td><td className="px-4 py-2 text-right">{u.orders}</td>
                    <td className="px-4 py-2 text-right text-ozx-success">{u.paid}</td>
                    <td className="px-4 py-2 text-right">R$ {Number(u.revenue || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {utm.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-ozx-muted">Sem dados de UTM ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="glass-card rounded-3xl p-6 max-w-xl">
            <h3 className="font-display text-xl mb-4">Métodos de pagamento</h3>
            {methods.map((m) => (
              <div key={m.method} className="flex justify-between py-2 border-b border-white/5 text-sm">
                <span>{methodLabel(m.method)}</span>
                <span><span className="text-ozx-muted">{m.count} pedidos · </span><span className="text-ozx-success">{m.paid} pagos</span></span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="profile">
          {profile && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card rounded-3xl p-6">
                <h3 className="font-display text-lg mb-4">Sexo</h3>
                {profile.by_gender.map((r) => <div key={r._id} className="flex justify-between py-1.5 text-sm border-b border-white/5"><span>{genderLabel(r._id)}</span><span className="text-ozx-primary">{r.count}</span></div>)}
              </div>
              <div className="glass-card rounded-3xl p-6">
                <h3 className="font-display text-lg mb-4">Estados</h3>
                {profile.by_state.map((r) => <div key={r._id} className="flex justify-between py-1.5 text-sm border-b border-white/5"><span>{r._id}</span><span className="text-ozx-primary">{r.count}</span></div>)}
              </div>
              <div className="glass-card rounded-3xl p-6">
                <h3 className="font-display text-lg mb-4">Cidades</h3>
                {profile.by_city.map((r) => <div key={r._id} className="flex justify-between py-1.5 text-sm border-b border-white/5"><span>{r._id}</span><span className="text-ozx-primary">{r.count}</span></div>)}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="abandoned">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex justify-end p-3 border-b border-white/5"><Button size="sm" variant="outline" className="border-white/15" onClick={() => downloadCSV("abandoned.csv", abandoned)}><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button></div>
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase text-ozx-muted"><tr><th className="text-left px-4 py-3">Cliente</th><th className="text-left px-4 py-3">E-mail</th><th className="text-left px-4 py-3">Telefone</th><th className="text-left px-4 py-3">Valor</th><th className="text-left px-4 py-3">Data</th></tr></thead>
              <tbody>
                {abandoned.map((o) => (
                  <tr key={o.order_id} className="border-t border-white/5">
                    <td className="px-4 py-2">{o.holder_name}</td><td className="px-4 py-2">{o.holder_email}</td>
                    <td className="px-4 py-2">{o.holder_phone}</td><td className="px-4 py-2">R$ {Number(o.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-2 text-xs text-ozx-muted">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
                {abandoned.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ozx-muted">Sem abandonos.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="glass-card rounded-3xl p-6">
            <p className="text-ozx-muted text-sm mb-4">Exporte todos os {orders.length} pedidos em CSV.</p>
            <Button onClick={() => downloadCSV("orders.csv", orders)} className="bg-ozx-primary text-ozx-bg"><Download className="w-4 h-4 mr-2" /> Baixar pedidos (CSV)</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

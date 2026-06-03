import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { api.get("/admin/orders").then((r) => setOrders(r.data)); }, []);

  const open = async (id) => {
    const { data } = await api.get(`/admin/orders/${id}`);
    setSelected(data);
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Vendas</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Pedidos</h1>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-ozx-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Pedido</th>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-left px-4 py-3">Ingresso</th>
              <th className="text-left px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => open(o.order_id)} data-testid={`admin-order-${o.order_id}`}>
                <td className="px-4 py-3 text-xs font-mono">{o.order_id.slice(-10)}</td>
                <td className="px-4 py-3">{o.holder_name}</td>
                <td className="px-4 py-3">{o.ticket_type_name} ({o.quantity}x)</td>
                <td className="px-4 py-3">R$ {Number(o.total_amount).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    o.status === "PAID" ? "bg-ozx-success/15 text-ozx-success" :
                    o.status === "WAITING" ? "bg-ozx-warning/15 text-ozx-warning" :
                    "bg-ozx-danger/15 text-ozx-danger"
                  }`}>{o.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-ozx-muted">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-ozx-muted">Nenhum pedido ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-2xl">
          <DialogHeader><DialogTitle>Pedido {selected?.order_id?.slice(-10)}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-ozx-muted text-xs uppercase">Cliente</p><p>{selected.holder_name}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">E-mail</p><p>{selected.holder_email}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">CPF</p><p>{selected.holder_cpf}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">Telefone</p><p>{selected.holder_phone}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">Status</p><p>{selected.status}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">Total</p><p>R$ {Number(selected.total_amount).toFixed(2)}</p></div>
              </div>
              {selected.companion && (
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs uppercase tracking-wider text-ozx-primary mb-2">Acompanhante</p>
                  <p>{selected.companion.name} · {selected.companion.email}</p>
                </div>
              )}
              {selected.credentials?.length > 0 && (
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs uppercase tracking-wider text-ozx-primary mb-2">Credenciais</p>
                  {selected.credentials.map((c) => (
                    <div key={c.credential_id} className="flex justify-between py-1">
                      <span>{c.name}</span>
                      <span className="text-ozx-muted text-xs">{c.credential_code} {c.checked_in && "✓"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

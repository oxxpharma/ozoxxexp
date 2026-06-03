import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Mail, Edit3, Eye, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { statusLabel, methodLabel } from "../../lib/labels";

const STATUSES = ["WAITING", "PAID", "IN_ANALYSIS", "DECLINED", "CANCELED", "REFUNDED", "COURTESY"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courtesyOpen, setCourtesyOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [lots, setLots] = useState([]);
  const [courtesyForm, setCourtesyForm] = useState({ holder_name: "", holder_email: "", holder_cpf: "", holder_phone: "", ticket_type_id: "", lot_id: "", has_companion: false, companion: { name: "", email: "", cpf: "", phone: "" }, notes: "" });

  const load = async () => { const { data } = await api.get("/admin/orders"); setOrders(data); };
  useEffect(() => {
    load();
    api.get("/admin/tickets").then((r) => setTickets(r.data));
    api.get("/admin/lots").then((r) => setLots(r.data));
  }, []);

  const openOrder = async (id) => { const { data } = await api.get(`/admin/orders/${id}`); setSelected(data); };

  const changeStatus = async (newStatus) => {
    if (!selected) return;
    await api.put(`/api/admin/orders-actions/${selected.order_id}/status`, { status: newStatus });
    toast.success("Status atualizado");
    await openOrder(selected.order_id);
    load();
  };

  const resendEmail = async () => {
    if (!selected) return;
    try {
      const { data } = await api.post(`/api/admin/orders-actions/${selected.order_id}/resend-email`);
      toast.success(`E-mail reenviado para ${data.sent}/${data.total} credenciais`);
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const downloadCredentialPdf = (credCode) => {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/admin/orders-actions/${selected.order_id}/credential-pdf/${credCode}`;
    window.open(url, "_blank");
  };

  const createCourtesy = async () => {
    if (!courtesyForm.ticket_type_id || !courtesyForm.holder_name || !courtesyForm.holder_email) return toast.error("Preencha os campos obrigatórios");
    const body = { ...courtesyForm };
    if (!body.has_companion) body.companion = null;
    if (!body.lot_id) delete body.lot_id;
    try {
      await api.post("/api/admin/orders-actions/manual-courtesy", body);
      toast.success("Cortesia gerada!");
      setCourtesyOpen(false);
      setCourtesyForm({ holder_name: "", holder_email: "", holder_cpf: "", holder_phone: "", ticket_type_id: "", lot_id: "", has_companion: false, companion: { name: "", email: "", cpf: "", phone: "" }, notes: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (filter && !`${o.holder_name} ${o.holder_email} ${o.order_id}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Vendas</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Pedidos</h1>
        </div>
        <Dialog open={courtesyOpen} onOpenChange={setCourtesyOpen}>
          <DialogTrigger asChild><Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="courtesy-new"><Plus className="w-4 h-4 mr-2" /> Gerar cortesia</Button></DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-2xl">
            <DialogHeader><DialogTitle>Gerar ingresso cortesia</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-2">
              <div className="col-span-2"><Label className="text-xs uppercase text-ozx-muted">Nome do contemplado</Label>
              <Input value={courtesyForm.holder_name} onChange={(e) => setCourtesyForm({ ...courtesyForm, holder_name: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="courtesy-name" /></div>
              <div><Label className="text-xs uppercase text-ozx-muted">E-mail</Label>
              <Input type="email" value={courtesyForm.holder_email} onChange={(e) => setCourtesyForm({ ...courtesyForm, holder_email: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="courtesy-email" /></div>
              <div><Label className="text-xs uppercase text-ozx-muted">Telefone</Label>
              <Input value={courtesyForm.holder_phone} onChange={(e) => setCourtesyForm({ ...courtesyForm, holder_phone: e.target.value })} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="col-span-2"><Label className="text-xs uppercase text-ozx-muted">Tipo de ingresso</Label>
              <Select value={courtesyForm.ticket_type_id} onValueChange={(v) => setCourtesyForm({ ...courtesyForm, ticket_type_id: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                  {tickets.map((t) => <SelectItem key={t.ticket_type_id} value={t.ticket_type_id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select></div>
              <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-white/5"><Label>Com acompanhante</Label>
              <Switch checked={courtesyForm.has_companion} onCheckedChange={(v) => setCourtesyForm({ ...courtesyForm, has_companion: v })} /></div>
              {courtesyForm.has_companion && (
                <>
                  <div><Label className="text-xs uppercase text-ozx-muted">Nome acompanhante</Label>
                  <Input value={courtesyForm.companion.name} onChange={(e) => setCourtesyForm({ ...courtesyForm, companion: { ...courtesyForm.companion, name: e.target.value } })} className="bg-white/5 border-white/10 text-white" /></div>
                  <div><Label className="text-xs uppercase text-ozx-muted">E-mail acompanhante</Label>
                  <Input type="email" value={courtesyForm.companion.email} onChange={(e) => setCourtesyForm({ ...courtesyForm, companion: { ...courtesyForm.companion, email: e.target.value } })} className="bg-white/5 border-white/10 text-white" /></div>
                </>
              )}
              <div className="col-span-2"><Label className="text-xs uppercase text-ozx-muted">Motivo (interno)</Label>
              <Textarea value={courtesyForm.notes} onChange={(e) => setCourtesyForm({ ...courtesyForm, notes: e.target.value })} rows={2} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="col-span-2"><Button onClick={createCourtesy} className="w-full bg-ozx-primary text-ozx-bg" data-testid="courtesy-submit">Gerar e enviar por e-mail</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 mb-4">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar..." className="bg-white/5 border-white/10 text-white max-w-md" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-ozx-bg2 text-white border-white/10">
            <SelectItem value="all">Todos status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-ozx-muted text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Pedido</th><th className="text-left px-4 py-3">Cliente</th><th className="text-left px-4 py-3">Ingresso</th><th className="text-left px-4 py-3">Total</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Data</th></tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.order_id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => openOrder(o.order_id)} data-testid={`admin-order-${o.order_id}`}>
                <td className="px-4 py-3 text-xs font-mono">{o.order_id.slice(-10)}</td>
                <td className="px-4 py-3">{o.holder_name}<br/><span className="text-xs text-ozx-muted">{o.holder_email}</span></td>
                <td className="px-4 py-3">{o.ticket_type_name} {o.lot_name && `· ${o.lot_name}`} ({o.quantity}x)</td>
                <td className="px-4 py-3">R$ {Number(o.total_amount).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    o.status === "PAID" ? "bg-ozx-success/15 text-ozx-success" :
                    o.status === "COURTESY" ? "bg-ozx-primary/15 text-ozx-primary" :
                    o.status === "WAITING" ? "bg-ozx-warning/15 text-ozx-warning" :
                    "bg-ozx-danger/15 text-ozx-danger"
                  }`}>{statusLabel(o.status)}</span>
                </td>
                <td className="px-4 py-3 text-xs text-ozx-muted">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-ozx-muted">Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pedido {selected?.order_id?.slice(-10)}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-ozx-muted text-xs uppercase">Cliente</p><p>{selected.holder_name}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">E-mail</p><p>{selected.holder_email}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">CPF</p><p>{selected.holder_cpf || "—"}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">Telefone</p><p>{selected.holder_phone || "—"}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">Total</p><p>R$ {Number(selected.total_amount).toFixed(2)}</p></div>
                <div><p className="text-ozx-muted text-xs uppercase">Pagamento</p><p>{methodLabel(selected.payment_method)}</p></div>
                {selected.coupon_code && <div><p className="text-ozx-muted text-xs uppercase">Cupom</p><p>{selected.coupon_code} (-R$ {Number(selected.discount || 0).toFixed(2)})</p></div>}
                {selected.utm?.utm_source && <div className="col-span-2"><p className="text-ozx-muted text-xs uppercase">UTM</p><p>{selected.utm.utm_source} · {selected.utm.utm_medium} · {selected.utm.utm_campaign || "—"}</p></div>}
              </div>

              {selected.companion && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-wider text-ozx-primary mb-2">Acompanhante</p>
                  <p>{selected.companion.name} · {selected.companion.email}</p>
                </div>
              )}

              <div className="border-t border-white/10 pt-3">
                <p className="text-xs uppercase tracking-wider text-ozx-primary mb-2">Status</p>
                <div className="flex items-center gap-2">
                  <Select value={selected.status} onValueChange={changeStatus}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white max-w-xs" data-testid="order-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={resendEmail} variant="outline" className="border-white/15" data-testid="order-resend-email"><Mail className="w-4 h-4 mr-2" /> Reenviar e-mail</Button>
                </div>
              </div>

              {selected.credentials?.length > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-wider text-ozx-primary mb-3">Credenciais</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selected.credentials.map((c) => (
                      <div key={c.credential_id} className="glass-card rounded-2xl p-4">
                        <p className="font-display">{c.name}</p>
                        <p className="text-xs text-ozx-muted mb-2">{c.credential_code} {c.checked_in && <span className="text-ozx-success ml-1">✓ Check-in</span>}</p>
                        {c.qr_png && <div className="bg-white rounded-xl p-3 flex justify-center mb-2"><img src={c.qr_png} alt="QR" className="w-32 h-32" /></div>}
                        <Button size="sm" variant="outline" className="border-white/15 w-full" onClick={() => downloadCredentialPdf(c.credential_code)} data-testid={`download-pdf-${c.credential_code}`}>
                          <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar PDF
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

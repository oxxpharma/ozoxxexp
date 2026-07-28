import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Mail, Eye, Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { statusLabel, methodLabel } from "../../lib/labels";

const STATUSES = ["WAITING", "PAID", "IN_ANALYSIS", "DECLINED", "CANCELED", "REFUNDED", "COURTESY"];
const PAYMENT_METHODS = ["pix", "credit_card", "courtesy"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ q: "", status: "all", payment_method: "all", date_from: "", date_to: "" });
  const [loading, setLoading] = useState(false);
  const [courtesyOpen, setCourtesyOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [lots, setLots] = useState([]);
  const [courtesyForm, setCourtesyForm] = useState({ holder_name: "", holder_email: "", holder_cpf: "", holder_phone: "", ticket_type_id: "", lot_id: "", has_companion: false, companion: { name: "", email: "", cpf: "", phone: "" }, notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.status !== "all") params.status = filters.status;
      if (filters.payment_method !== "all") params.payment_method = filters.payment_method;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const { data } = await api.get("/admin/orders", { params });
      setOrders(data);
    } catch (e) {
      toast.error("Erro ao carregar pedidos");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.get("/admin/tickets").then((r) => setTickets(r.data));
    api.get("/admin/lots").then((r) => setLots(r.data));
  }, []); // eslint-disable-line

  // Reload when filters change (debounced for the text query)
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [filters]); // eslint-disable-line

  const clearFilters = () => setFilters({ q: "", status: "all", payment_method: "all", date_from: "", date_to: "" });

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

  const deleteOrder = async (orderId, holderName, ev) => {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    const short = orderId.slice(-10);
    if (!confirm(`Excluir o pedido ${short} de ${holderName}?\n\nA credencial e o QR Code deste pedido serão removidos permanentemente. Esta ação NÃO pode ser desfeita.`)) return;
    try {
      const { data } = await api.delete(`/admin/orders-actions/${orderId}`);
      toast.success(`Pedido excluído · ${data.credentials_deleted} credencial(is) removida(s)`);
      if (selected?.order_id === orderId) setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao excluir");
    }
  };

  const filtered = orders;

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

      <div className="glass-card rounded-2xl p-4 mb-4 space-y-3" data-testid="orders-filters">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Busca (nome, e-mail, CPF, telefone, pedido, cupom)</Label>
            <Input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Digite para filtrar..."
              className="bg-white/5 border-white/10 text-white"
              data-testid="orders-filter-q"
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="orders-filter-status"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Forma de pagamento</Label>
            <Select value={filters.payment_method} onValueChange={(v) => setFilters({ ...filters, payment_method: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="orders-filter-method"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                <SelectItem value="all">Todas</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">De</Label>
            <Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="orders-filter-from" />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Até</Label>
            <Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="orders-filter-to" />
          </div>
          <div className="md:col-span-3 flex items-end">
            <Button variant="outline" onClick={clearFilters} className="border-white/15 text-white w-full" data-testid="orders-filter-clear">
              Limpar filtros
            </Button>
          </div>
          <div className="md:col-span-3 flex items-end">
            <Button variant="ghost" onClick={load} className="text-ozx-muted hover:text-white w-full" data-testid="orders-filter-refresh">
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>
        </div>
        <p className="text-xs text-ozx-muted">
          {loading ? "Carregando..." : `${filtered.length} pedido${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-ozx-muted text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Pedido</th><th className="text-left px-4 py-3">Cliente</th><th className="text-left px-4 py-3">Ingresso</th><th className="text-left px-4 py-3">Total</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Data</th><th className="text-right px-4 py-3">Ações</th></tr>
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
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-ozx-danger hover:bg-ozx-danger/10 hover:text-ozx-danger h-8 w-8 p-0"
                    onClick={(e) => deleteOrder(o.order_id, o.holder_name, e)}
                    data-testid={`delete-order-${o.order_id}`}
                    title="Excluir pedido"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-ozx-muted">Nenhum pedido.</td></tr>}
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
                  <Button onClick={() => deleteOrder(selected.order_id, selected.holder_name)} variant="outline" className="border-ozx-danger/40 text-ozx-danger hover:bg-ozx-danger/10 hover:text-ozx-danger ml-auto" data-testid="order-delete">
                    <Trash2 className="w-4 h-4 mr-2" /> Excluir pedido
                  </Button>
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

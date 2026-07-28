import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { ticket_type_id: "", name: "", price: 0, quantity: 100, valid_until: "", order: 1, is_active: true, installment_price: "", installments_count: "", cash_price: "" };

export default function AdminLots() {
  const [items, setItems] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [l, t] = await Promise.all([api.get("/admin/lots"), api.get("/admin/tickets")]);
    setItems(l.data); setTickets(t.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const body = {
      ...form,
      price: Number(form.price),
      quantity: Number(form.quantity),
      order: Number(form.order),
      installment_price: form.installment_price === "" || form.installment_price == null ? null : Number(form.installment_price),
      installments_count: form.installments_count === "" || form.installments_count == null ? null : Number(form.installments_count),
      cash_price: form.cash_price === "" || form.cash_price == null ? null : Number(form.cash_price),
    };
    if (!body.valid_until) body.valid_until = null;
    try {
      if (editing) await api.put(`/admin/lots/${editing}`, body);
      else await api.post("/admin/lots", body);
      toast.success("Salvo");
      setOpen(false); setEditing(null); setForm(empty); load();
    } catch (e) { toast.error("Erro"); }
  };
  const del = async (id) => { if (!confirm("Deletar lote?")) return; await api.delete(`/admin/lots/${id}`); load(); };
  const edit = (l) => { setForm({ ticket_type_id: l.ticket_type_id, name: l.name, price: l.price, quantity: l.quantity, valid_until: l.valid_until || "", order: l.order, is_active: l.is_active, installment_price: l.installment_price ?? "", installments_count: l.installments_count ?? "", cash_price: l.cash_price ?? "" }); setEditing(l.lot_id); setOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Vendas</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Lotes</h1>
          <p className="text-ozx-muted mt-1 text-sm">Configure faixas de preço com quantidade limitada (ex: 1º lote promocional, lote final, VIP).</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="lot-new"><Plus className="w-4 h-4 mr-2" /> Novo lote</Button>
          </DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} lote</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Ingresso</Label>
                <Select value={form.ticket_type_id} onValueChange={(v) => setForm({ ...form, ticket_type_id: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                    {tickets.map((t) => <SelectItem key={t.ticket_type_id} value={t.ticket_type_id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Nome do lote</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="1º Lote, VIP..." className="bg-white/5 border-white/10 text-white" data-testid="lot-form-name" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="lot-form-price" />
                </div>
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Quantidade</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Ordem</Label>
                  <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Data limite (lote expira após)</Label>
                <Input type="datetime-local" value={form.valid_until ? form.valid_until.slice(0, 16) : ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value ? `${e.target.value}:00-03:00` : "" })} className="bg-white/5 border-white/10 text-white" data-testid="lot-form-valid-until" />
                <p className="text-xs text-ozx-muted mt-1">Deixe vazio para sem data limite. O lote ficará &quot;Encerrado&quot; após esta data, mesmo com vagas.</p>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs uppercase tracking-wider text-ozx-primary mb-2">Exibição de preço no card (opcional)</p>
                <p className="text-xs text-ozx-muted mb-3">Use estes campos pra mostrar &quot;10x R$ 130,00 ou R$ 1.200,00 à vista&quot; na landing. Se deixar vazio, o card mostra só o preço acima.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs uppercase text-ozx-muted">Parcelas</Label>
                    <Input type="number" min="1" placeholder="10" value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="lot-form-installments-count" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-ozx-muted">Valor da parcela (R$)</Label>
                    <Input type="number" step="0.01" placeholder="130.00" value={form.installment_price} onChange={(e) => setForm({ ...form, installment_price: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="lot-form-installment-price" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-ozx-muted">À vista (R$)</Label>
                    <Input type="number" step="0.01" placeholder="1200.00" value={form.cash_price} onChange={(e) => setForm({ ...form, cash_price: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="lot-form-cash-price" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="lot-form-save">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {items.map((l) => {
          const ticket = tickets.find((t) => t.ticket_type_id === l.ticket_type_id);
          const pct = l.progress_pct || 0;
          const statusLabel = l.is_sold_out ? "ESGOTADO" : l.is_expired ? "ENCERRADO" : (!l.is_active ? "INATIVO" : null);
          return (
            <div key={l.lot_id} className={`glass-card rounded-2xl p-5 ${(l.is_sold_out || l.is_expired || !l.is_active) ? "opacity-60" : ""}`} data-testid={`lot-row-${l.lot_id}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display text-lg">
                    {l.name}
                    {statusLabel && <span className="text-xs px-2 py-0.5 ml-2 rounded-full bg-ozx-danger/15 text-ozx-danger">{statusLabel}</span>}
                  </p>
                  <p className="text-xs text-ozx-muted">
                    {ticket?.name} · R$ {Number(l.price).toFixed(2)} · {l.sold_qty}/{l.quantity} ({pct}% vendidos)
                    {l.valid_until && ` · até ${new Date(l.valid_until).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-white/15" onClick={() => edit(l)}><Edit3 className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger" onClick={() => del(l.lot_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-ozx-primary to-ozx-primaryHover progress-glow" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-ozx-muted text-sm">Nenhum lote criado ainda.</p>}
      </div>
    </div>
  );
}

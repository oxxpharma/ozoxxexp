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

const empty = { ticket_type_id: "", name: "", price: 0, quantity: 100, order: 1, is_active: true };

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
    const body = { ...form, price: Number(form.price), quantity: Number(form.quantity), order: Number(form.order) };
    try {
      if (editing) await api.put(`/admin/lots/${editing}`, body);
      else await api.post("/admin/lots", body);
      toast.success("Salvo");
      setOpen(false); setEditing(null); setForm(empty); load();
    } catch (e) { toast.error("Erro"); }
  };
  const del = async (id) => { if (!confirm("Deletar lote?")) return; await api.delete(`/admin/lots/${id}`); load(); };
  const edit = (l) => { setForm({ ticket_type_id: l.ticket_type_id, name: l.name, price: l.price, quantity: l.quantity, order: l.order, is_active: l.is_active }); setEditing(l.lot_id); setOpen(true); };

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
              <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="lot-form-save">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {items.map((l) => {
          const ticket = tickets.find((t) => t.ticket_type_id === l.ticket_type_id);
          const pct = l.quantity ? (l.sold_qty / l.quantity) * 100 : 0;
          return (
            <div key={l.lot_id} className="glass-card rounded-2xl p-5" data-testid={`lot-row-${l.lot_id}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-display text-lg">{l.name} {!l.is_active && <span className="text-xs text-ozx-muted ml-2">(inativo)</span>}</p>
                  <p className="text-xs text-ozx-muted">{ticket?.name} · R$ {Number(l.price).toFixed(2)} · {l.sold_qty}/{l.quantity} vendidos</p>
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

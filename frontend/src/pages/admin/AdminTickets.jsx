import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", description: "", price: 0, quantity_available: 100, is_active: true };

export default function AdminTickets() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const { data } = await api.get("/admin/tickets");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const body = { ...form, price: Number(form.price), quantity_available: Number(form.quantity_available) };
    try {
      if (editing) {
        await api.put(`/admin/tickets/${editing}`, body);
        toast.success("Atualizado");
      } else {
        await api.post("/admin/tickets", body);
        toast.success("Criado");
      }
      setOpen(false); setEditing(null); setForm(empty); load();
    } catch (e) { toast.error("Erro"); }
  };

  const del = async (id) => {
    if (!confirm("Deletar ingresso?")) return;
    await api.delete(`/admin/tickets/${id}`);
    load();
  };

  const edit = (t) => {
    setForm({ name: t.name, description: t.description, price: t.price, quantity_available: t.quantity_available, is_active: t.is_active });
    setEditing(t.ticket_type_id);
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Catálogo</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Ingressos</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="ticket-new">
              <Plus className="w-4 h-4 mr-2" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} ingresso</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-ozx-muted text-xs uppercase">Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="ticket-form-name" />
              </div>
              <div>
                <Label className="text-ozx-muted text-xs uppercase">Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-ozx-muted text-xs uppercase">Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="ticket-form-price" />
                </div>
                <div>
                  <Label className="text-ozx-muted text-xs uppercase">Qtd disponível</Label>
                  <Input type="number" value={form.quantity_available} onChange={(e) => setForm({ ...form, quantity_available: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="ticket-form-save">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.ticket_type_id} className="glass-card rounded-2xl p-5 flex items-center justify-between" data-testid={`ticket-row-${t.ticket_type_id}`}>
            <div>
              <p className="font-display text-lg">{t.name} {!t.is_active && <span className="text-xs text-ozx-muted ml-2">(inativo)</span>}</p>
              <p className="text-xs text-ozx-muted">R$ {Number(t.price).toFixed(2)} · {t.quantity_available} disponíveis</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-white/15" onClick={() => edit(t)}><Edit3 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger hover:bg-ozx-danger/10" onClick={() => del(t.ticket_type_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

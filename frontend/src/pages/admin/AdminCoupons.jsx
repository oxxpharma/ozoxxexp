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

const empty = { code: "", description: "", discount_type: "percent", discount_value: 10, max_uses: null, valid_until: null, is_active: true };

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => { const { data } = await api.get("/admin/coupons"); setItems(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const body = { ...form, discount_value: Number(form.discount_value), max_uses: form.max_uses ? Number(form.max_uses) : null };
    try {
      if (editing) await api.put(`/admin/coupons/${editing}`, body);
      else await api.post("/admin/coupons", body);
      toast.success("Salvo"); setOpen(false); setEditing(null); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };
  const del = async (id) => { if (!confirm("Deletar cupom?")) return; await api.delete(`/admin/coupons/${id}`); load(); };
  const edit = (c) => { setForm({ code: c.code, description: c.description || "", discount_type: c.discount_type, discount_value: c.discount_value, max_uses: c.max_uses, valid_until: c.valid_until, is_active: c.is_active }); setEditing(c.coupon_id); setOpen(true); };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Marketing</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Cupons</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="coupon-new"><Plus className="w-4 h-4 mr-2" /> Novo cupom</Button></DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cupom</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!editing && (
                <div><Label className="text-xs uppercase text-ozx-muted">Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="OZX2026" className="bg-white/5 border-white/10 text-white" data-testid="coupon-form-code" /></div>
              )}
              <div><Label className="text-xs uppercase text-ozx-muted">Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs uppercase text-ozx-muted">Tipo</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}><SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                    <SelectItem value="percent">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                  </SelectContent></Select></div>
                <div><Label className="text-xs uppercase text-ozx-muted">Valor</Label>
                <Input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="coupon-form-value" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs uppercase text-ozx-muted">Usos máx (vazio = ilimitado)</Label>
                <Input type="number" value={form.max_uses || ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="bg-white/5 border-white/10 text-white" /></div>
                <div><Label className="text-xs uppercase text-ozx-muted">Válido até (ISO)</Label>
                <Input value={form.valid_until || ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} placeholder="2026-12-31T23:59:59-03:00" className="bg-white/5 border-white/10 text-white" /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="coupon-form-save">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.coupon_id} className="glass-card rounded-2xl p-4 flex items-center justify-between" data-testid={`coupon-row-${c.code}`}>
            <div>
              <p className="font-mono font-display text-lg text-ozx-primary">{c.code}</p>
              <p className="text-xs text-ozx-muted">{c.description || "—"} · {c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${c.discount_value}`} · usado {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              {!c.is_active && <span className="text-xs text-ozx-danger">inativo</span>}
              <Button size="sm" variant="outline" className="border-white/15" onClick={() => edit(c)}><Edit3 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger" onClick={() => del(c.coupon_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-ozx-muted text-sm">Nenhum cupom criado.</p>}
      </div>
    </div>
  );
}

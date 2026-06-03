import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminLeaders() {
  const [leaders, setLeaders] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", target_sales: 10 });

  const load = async () => {
    const [l, u] = await Promise.all([api.get("/admin/leaders"), api.get("/admin/users")]);
    setLeaders(l.data);
    setUsers(u.data.filter((x) => x.role !== "admin"));
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post("/admin/leaders", { ...form, target_sales: Number(form.target_sales) });
      toast.success("Líder promovido!");
      setOpen(false); setForm({ user_id: "", target_sales: 10 }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const del = async (id) => { if (!confirm("Remover líder?")) return; await api.delete(`/admin/leaders/${id}`); load(); };

  const copyLink = (slug) => {
    const url = `${window.location.origin}/l/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado: " + url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Vendas</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Líderes</h1>
          <p className="text-ozx-muted text-sm mt-1">Promova usuários a líderes. Eles vendem ingressos com link único e ganham o próprio ao bater meta.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="leader-new"><Plus className="w-4 h-4 mr-2" /> Promover usuário</Button></DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white">
            <DialogHeader><DialogTitle>Promover a Líder</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Usuário</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="leader-form-user"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-ozx-bg2 text-white border-white/10 max-h-80">
                    {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Meta de ingressos vendidos</Label>
                <Input type="number" value={form.target_sales} onChange={(e) => setForm({ ...form, target_sales: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="leader-form-target" />
                <p className="text-xs text-ozx-muted mt-1">Ao atingir esta meta, o líder ganha automaticamente seu ingresso de cortesia.</p>
              </div>
              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="leader-form-save">Promover</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {leaders.map((l) => (
          <div key={l.leader_id} className="glass-card rounded-2xl p-5" data-testid={`leader-row-${l.slug}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-display text-lg">{l.user?.name} {l.goal_reached && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-ozx-success/20 text-ozx-success">META BATIDA 🎉</span>}</p>
                <p className="text-xs text-ozx-muted">{l.user?.email}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-white/15" onClick={() => copyLink(l.slug)} data-testid={`leader-copy-link-${l.slug}`}><Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar link</Button>
                <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger" onClick={() => del(l.leader_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
              <div><p className="text-ozx-muted">Vendidos</p><p className="font-display text-xl">{l.tickets_sold}</p></div>
              <div><p className="text-ozx-muted">Meta</p><p className="font-display text-xl">{l.target_sales}</p></div>
              <div><p className="text-ozx-muted">Receita</p><p className="font-display text-xl text-ozx-success">R$ {Number(l.revenue).toFixed(2)}</p></div>
              <div><p className="text-ozx-muted">Pendentes</p><p className="font-display text-xl text-ozx-warning">{l.pending_orders}</p></div>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-ozx-primary to-ozx-primaryHover progress-glow" style={{ width: `${l.progress_pct}%` }} />
            </div>
            <p className="text-xs text-ozx-muted mt-2">/l/{l.slug} · {l.progress_pct}%</p>
          </div>
        ))}
        {leaders.length === 0 && <p className="text-ozx-muted text-sm">Nenhum líder ainda.</p>}
      </div>
    </div>
  );
}

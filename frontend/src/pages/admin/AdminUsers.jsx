import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Edit3, Trash2, Award } from "lucide-react";
import { toast } from "sonner";
import { roleLabel } from "../../lib/labels";

const ROLES = ["admin", "comercial", "financeiro", "credenciadora", "lider", "participante"];
const empty = { name: "", email: "", password: "", role: "participante", phone: "", cpf: "", birth_date: "", gender: "", city: "", state: "", active: true };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const load = async () => { const { data } = await api.get("/admin/users"); setUsers(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editing) {
        const body = { ...form }; if (!form.password) delete body.password; delete body.email;
        await api.put(`/admin/users/${editing}`, body);
      } else {
        await api.post("/admin/users", form);
      }
      toast.success("Salvo"); setOpen(false); setEditing(null); setForm(empty); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };
  const del = async (id) => { if (!confirm("Deletar usuário?")) return; await api.delete(`/admin/users/${id}`); load(); };
  const edit = (u) => { setForm({ ...empty, ...u, password: "", active: u.active !== false }); setEditing(u.user_id); setOpen(true); };
  const promote = async (u) => {
    const target = parseInt(prompt(`Promover ${u.name} a líder. Qual a meta de ingressos vendidos?`, "10"));
    if (!target) return;
    try { await api.put(`/admin/users/${u.user_id}/promote-leader`, { target_sales: target }); toast.success("Promovido!"); load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (filter && !`${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Acesso</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Usuários</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="user-new"><Plus className="w-4 h-4 mr-2" /> Novo usuário</Button></DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-xl">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} usuário</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-2">
              <div className="col-span-2">
                <Label className="text-xs uppercase text-ozx-muted">Nome completo</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="user-form-name" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs uppercase text-ozx-muted">E-mail</Label>
                <Input disabled={!!editing} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10 text-white disabled:opacity-50" data-testid="user-form-email" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">{editing ? "Nova senha (opcional)" : "Senha"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Função</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="user-form-role"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Data de nascimento</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Sexo</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Estado (UF)</Label>
                <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} className="bg-white/5 border-white/10 text-white" />
              </div>
              {editing && (
                <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <Label>Usuário ativo</Label>
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                </div>
              )}
              <div className="col-span-2 pt-2">
                <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="user-form-save">Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 mb-4">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nome/e-mail..." className="bg-white/5 border-white/10 text-white max-w-md" data-testid="user-search" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-ozx-bg2 text-white border-white/10">
            <SelectItem value="all">Todas funções</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((u) => (
          <div key={u.user_id} className="glass-card rounded-2xl p-4 flex items-center justify-between" data-testid={`user-row-${u.email}`}>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-ozx-primary to-ozx-secondary flex items-center justify-center font-display text-sm">{u.name?.[0]?.toUpperCase()}</div>
              <div>
                <p className="text-sm">{u.name}</p>
                <p className="text-xs text-ozx-muted">{u.email} {u.phone && `· ${u.phone}`} {u.city && `· ${u.city}/${u.state || ""}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded-full bg-ozx-primary/10 border border-ozx-primary/20 text-ozx-primary uppercase tracking-wider">{roleLabel(u.role)}</span>
              {u.active === false && <span className="text-xs text-ozx-danger">inativo</span>}
              {u.role !== "admin" && u.role !== "lider" && (
                <Button size="sm" variant="outline" className="border-ozx-primary/40 text-ozx-primary" onClick={() => promote(u)} data-testid={`promote-leader-${u.email}`}><Award className="w-3.5 h-3.5" /></Button>
              )}
              <Button size="sm" variant="outline" className="border-white/15" onClick={() => edit(u)}><Edit3 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger" onClick={() => del(u.user_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

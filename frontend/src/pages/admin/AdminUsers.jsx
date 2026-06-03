import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Edit3, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["admin", "comercial", "financeiro", "credenciadora", "participante"];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "participante", phone: "", cpf: "", active: true });

  const load = async () => { const { data } = await api.get("/admin/users"); setUsers(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      if (editing) {
        const body = { ...form };
        if (!form.password) delete body.password;
        delete body.email;
        await api.put(`/admin/users/${editing}`, body);
        toast.success("Atualizado");
      } else {
        await api.post("/admin/users", form);
        toast.success("Criado");
      }
      setOpen(false); setEditing(null); setForm({ name: "", email: "", password: "", role: "participante", phone: "", cpf: "", active: true }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const del = async (id) => {
    if (!confirm("Deletar usuário?")) return;
    try { await api.delete(`/admin/users/${id}`); load(); } catch (e) { toast.error("Erro"); }
  };

  const edit = (u) => {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, phone: u.phone || "", cpf: u.cpf || "", active: u.active !== false });
    setEditing(u.user_id);
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Acesso</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Usuários</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: "", email: "", password: "", role: "participante", phone: "", cpf: "", active: true }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="user-new">
              <Plus className="w-4 h-4 mr-2" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="user-form-name" />
              {!editing && (
                <Input placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="user-form-email" />
              )}
              <Input placeholder={editing ? "Nova senha (opcional)" : "Senha"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="user-form-role"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              <Input placeholder="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              {editing && (
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                </div>
              )}
              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="user-form-save">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.user_id} className="glass-card rounded-2xl p-4 flex items-center justify-between" data-testid={`user-row-${u.email}`}>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-ozx-primary to-ozx-secondary flex items-center justify-center font-display text-sm">
                {u.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm">{u.name}</p>
                <p className="text-xs text-ozx-muted">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2 py-1 rounded-full bg-ozx-primary/10 border border-ozx-primary/20 text-ozx-primary uppercase tracking-wider">{u.role}</span>
              {u.active === false && <span className="text-xs text-ozx-danger">inativo</span>}
              <Button size="sm" variant="outline" className="border-white/15" onClick={() => edit(u)}><Edit3 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger" onClick={() => del(u.user_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* eslint-disable */
import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Edit3, Trash2, Award, KeyRound, Send, Loader2 } from "lucide-react";
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
  const [reactOpen, setReactOpen] = useState(false);
  const [reactivation, setReactivation] = useState({ loading: false, running: false, data: null, result: null });
  const [sendEmails, setSendEmails] = useState(true);

  const load = async () => { const { data } = await api.get("/admin/users"); setUsers(data); };
  useEffect(() => { load(); }, []);

  const handleOpenReactivation = async () => {
    setReactOpen(true);
    setReactivation({ loading: true, running: false, data: null, result: null });
    try {
      const { data } = await api.get("/admin/users-actions/orphan-buyers");
      setReactivation((s) => ({ ...s, loading: false, data }));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao carregar prévia");
      setReactivation((s) => ({ ...s, loading: false }));
    }
  };

  const runReactivation = async () => {
    const previewData = reactivation.data;
    if (!confirm(`Confirma a criação de contas para ${previewData?.needs_account || 0} comprador(es) sem cadastro? ${sendEmails ? "Um e-mail com link de definir senha (válido por 7 dias) será enviado." : "Nenhum e-mail será enviado."}`)) return;
    setReactivation((s) => ({ ...s, running: true }));
    try {
      const { data } = await api.post("/admin/users-actions/reactivate", { dry_run: false, send_emails: sendEmails });
      toast.success(`Contas criadas: ${data.created} · E-mails enviados: ${data.emails_sent}`);
      const refresh = await api.get("/admin/users-actions/orphan-buyers");
      setReactivation({ loading: false, running: false, data: refresh.data, result: data });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao executar");
      setReactivation((s) => ({ ...s, running: false }));
    }
  };

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

  const previewData = reactivation.data;
  const previewLoading = reactivation.loading;
  const reactRunning = reactivation.running;
  const reactResult = reactivation.result;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Acesso</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Usuários</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/15 text-white rounded-full" onClick={() => handleOpenReactivation()} data-testid="reactivate-old-buyers-btn">
            <KeyRound className="w-4 h-4 mr-2" /> Reativar contas antigas
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild>
              <Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="user-new"><Plus className="w-4 h-4 mr-2" /> Novo usuário</Button>
            </DialogTrigger>
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

      <Dialog open={reactOpen} onOpenChange={(v) => setReactOpen(v)}>
        <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-ozx-primary" /> Reativar contas antigas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2" data-testid="reactivate-dialog-body">
            <p className="text-sm text-ozx-muted leading-relaxed">
              Compradores que finalizaram um pedido <span className="text-white">antes</span> do checkout pedir senha não têm acesso ao painel. Esta ação cria uma conta para cada e-mail comprador e envia um link de definir senha (válido por 7 dias).
            </p>

            {previewLoading && (
              <div className="flex items-center gap-2 text-ozx-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Calculando candidatos...</div>
            )}

            {previewData && !previewLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-ozx-muted">Compradores</p>
                  <p className="font-display text-2xl" data-testid="react-total">{previewData.total}</p>
                </div>
                <div className="rounded-2xl p-3 bg-ozx-primary/10 border border-ozx-primary/30">
                  <p className="text-[10px] uppercase tracking-wider text-ozx-primary">Sem conta</p>
                  <p className="font-display text-2xl text-ozx-primary" data-testid="react-needs-account">{previewData.needs_account}</p>
                </div>
                <div className="rounded-2xl p-3 bg-ozx-warning/10 border border-ozx-warning/30">
                  <p className="text-[10px] uppercase tracking-wider text-ozx-warning">Sem senha</p>
                  <p className="font-display text-2xl text-ozx-warning">{previewData.needs_password}</p>
                </div>
                <div className="rounded-2xl p-3 bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-wider text-ozx-muted">Já ativos</p>
                  <p className="font-display text-2xl text-ozx-muted">{previewData.ok}</p>
                </div>
              </div>
            )}

            {previewData && !previewLoading && previewData.items?.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-white/10 rounded-2xl divide-y divide-white/5">
                {previewData.items.slice(0, 50).map((it) => (
                  <div key={it.email} className="flex items-center justify-between p-2 px-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="text-white truncate">{it.name || it.email}</p>
                      <p className="text-ozx-muted truncate">{it.email} · {it.orders_count} pedido(s)</p>
                    </div>
                    <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] ${
                      it.status === "ok" ? "bg-ozx-success/10 text-ozx-success border border-ozx-success/30" :
                      it.status === "needs_account" ? "bg-ozx-primary/10 text-ozx-primary border border-ozx-primary/30" :
                      it.status === "needs_password" ? "bg-ozx-warning/10 text-ozx-warning border border-ozx-warning/30" :
                      "bg-white/5 text-ozx-muted border border-white/10"
                    }`}>{it.status.replace("_", " ")}</span>
                  </div>
                ))}
                {previewData.items.length > 50 && (
                  <div className="p-2 px-3 text-xs text-ozx-muted text-center">+ {previewData.items.length - 50} outros...</div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div>
                <Label className="text-sm">Enviar e-mail com link de definir senha</Label>
                <p className="text-xs text-ozx-muted">Se desativar, as contas serão criadas mas o usuário não saberá. Use só se for avisar por outro canal.</p>
              </div>
              <Switch checked={sendEmails} onCheckedChange={setSendEmails} data-testid="react-send-emails-switch" />
            </div>

            {reactResult && (
              <div className="rounded-2xl p-4 bg-ozx-success/10 border border-ozx-success/30 text-sm space-y-1" data-testid="react-result">
                <p className="text-ozx-success font-semibold mb-2">Concluído</p>
                <p>Contas criadas: <span className="text-white font-medium">{reactResult.created}</span></p>
                <p>Contas existentes sem senha (link enviado): <span className="text-white font-medium">{reactResult.password_pending}</span></p>
                <p>Pedidos órfãos linkados: <span className="text-white font-medium">{reactResult.linked_orders}</span></p>
                <p>E-mails enviados: <span className="text-white font-medium">{reactResult.emails_sent}</span> · falhas: <span className="text-white font-medium">{reactResult.emails_failed}</span></p>
                <p className="text-ozx-muted">Pulados (já ativos): {reactResult.skipped_already_active}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-white/15 text-white" onClick={() => setReactOpen(false)}>Fechar</Button>
              <Button
                onClick={runReactivation}
                disabled={previewLoading || reactRunning || !previewData || (previewData.needs_account + previewData.needs_password === 0)}
                className="flex-1 bg-ozx-primary text-ozx-bg font-semibold"
                data-testid="react-confirm-btn"
              >
                {reactRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando...</> : <><Send className="w-4 h-4 mr-2" /> Reativar {(previewData?.needs_account || 0) + (previewData?.needs_password || 0)} conta(s)</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Plus, Edit3, Trash2, X, Search, Users } from "lucide-react";
import { toast } from "sonner";

const empty = {
  code: "",
  description: "",
  discount_type: "percent",
  discount_value: 10,
  max_uses: null,
  max_uses_per_user: null,
  valid_until: null,
  is_active: true,
  allowed_user_ids: [],
};

export default function AdminCoupons() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [userSearch, setUserSearch] = useState("");

  const load = async () => {
    const [c, u] = await Promise.all([api.get("/admin/coupons"), api.get("/admin/users")]);
    setItems(c.data);
    setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const body = {
      ...form,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      max_uses_per_user: form.max_uses_per_user ? Number(form.max_uses_per_user) : null,
      allowed_user_ids: form.allowed_user_ids || [],
    };
    try {
      if (editing) await api.put(`/admin/coupons/${editing}`, body);
      else await api.post("/admin/coupons", body);
      toast.success("Salvo");
      setOpen(false); setEditing(null); setForm(empty); setUserSearch(""); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };
  const del = async (id) => { if (!confirm("Deletar cupom?")) return; await api.delete(`/admin/coupons/${id}`); load(); };
  const edit = (c) => {
    setForm({
      code: c.code,
      description: c.description || "",
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      max_uses: c.max_uses,
      max_uses_per_user: c.max_uses_per_user,
      valid_until: c.valid_until,
      is_active: c.is_active,
      allowed_user_ids: c.allowed_user_ids || [],
    });
    setEditing(c.coupon_id); setOpen(true);
  };

  const toggleUser = (userId) => {
    setForm((f) => {
      const list = f.allowed_user_ids || [];
      return { ...f, allowed_user_ids: list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId] };
    });
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users.slice(0, 30);
    const q = userSearch.toLowerCase();
    return users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q)).slice(0, 30);
  }, [users, userSearch]);

  const selectedUsers = useMemo(
    () => users.filter((u) => (form.allowed_user_ids || []).includes(u.user_id)),
    [users, form.allowed_user_ids]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Marketing</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Cupons</h1>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); setUserSearch(""); } }}>
          <DialogTrigger asChild>
            <Button className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="coupon-new"><Plus className="w-4 h-4 mr-2" /> Novo cupom</Button>
          </DialogTrigger>
          <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cupom</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!editing && (
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Código</Label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="OZX2026" className="bg-white/5 border-white/10 text-white" data-testid="coupon-form-code" />
                </div>
              )}
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Descrição</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Tipo</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                      <SelectItem value="percent">Percentual</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Valor</Label>
                  <Input type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="coupon-form-value" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Usos máx total (vazio = ilimitado)</Label>
                  <Input type="number" value={form.max_uses || ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="coupon-form-max-uses" />
                  <p className="text-[10px] text-ozx-muted mt-1">Soma de todos os usuários</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-ozx-muted">Usos por usuário (vazio = ilimitado)</Label>
                  <Input type="number" min="1" value={form.max_uses_per_user || ""} onChange={(e) => setForm({ ...form, max_uses_per_user: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="coupon-form-max-uses-per-user" placeholder="ex: 1" />
                  <p className="text-[10px] text-ozx-muted mt-1">Ex: 1 = cada e-mail só pode usar 1 vez</p>
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted">Válido até (ISO)</Label>
                <Input value={form.valid_until || ""} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} placeholder="2026-12-31T23:59:59-03:00" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>

              {/* User restriction */}
              <div className="pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-ozx-primary" />
                  <p className="text-xs uppercase tracking-wider text-ozx-primary">Restringir a usuários específicos (opcional)</p>
                </div>
                <p className="text-xs text-ozx-muted mb-3">Se deixar vazio, qualquer pessoa pode usar. Se selecionar usuários, só quem digitar o e-mail deles no checkout conseguirá aplicar.</p>

                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3" data-testid="coupon-selected-users">
                    {selectedUsers.map((u) => (
                      <span key={u.user_id} className="inline-flex items-center gap-1 bg-ozx-primary/15 border border-ozx-primary/30 text-ozx-primary rounded-full px-3 py-1 text-xs">
                        {u.name || u.email}
                        <button
                          type="button"
                          onClick={() => toggleUser(u.user_id)}
                          className="hover:bg-ozx-primary/20 rounded-full p-0.5"
                          data-testid={`coupon-remove-user-${u.email}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ozx-muted" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar usuário por nome ou e-mail..."
                    className="bg-white/5 border-white/10 text-white pl-9"
                    data-testid="coupon-user-search"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5">
                  {filteredUsers.map((u) => {
                    const checked = (form.allowed_user_ids || []).includes(u.user_id);
                    return (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => toggleUser(u.user_id)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 ${checked ? "bg-ozx-primary/5" : ""}`}
                        data-testid={`coupon-user-${u.email}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-white truncate">{u.name || u.email}</p>
                          <p className="text-ozx-muted truncate">{u.email}</p>
                        </div>
                        <span className={`shrink-0 ml-2 w-4 h-4 rounded border flex items-center justify-center ${checked ? "bg-ozx-primary border-ozx-primary" : "border-white/20"}`}>
                          {checked && <span className="text-ozx-bg text-[10px]">✓</span>}
                        </span>
                      </button>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <p className="text-ozx-muted text-xs text-center py-4">Nenhum usuário encontrado</p>
                  )}
                </div>
                {users.length > 30 && !userSearch && (
                  <p className="text-[10px] text-ozx-muted mt-1">Mostrando 30 primeiros. Use a busca para encontrar mais.</p>
                )}
              </div>

              <Button onClick={submit} className="w-full bg-ozx-primary text-ozx-bg" data-testid="coupon-form-save">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.coupon_id} className="glass-card rounded-2xl p-4 flex items-center justify-between" data-testid={`coupon-row-${c.code}`}>
            <div className="min-w-0 flex-1">
              <p className="font-mono font-display text-lg text-ozx-primary">{c.code}</p>
              <p className="text-xs text-ozx-muted">
                {c.description || "—"} · {c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${c.discount_value}`} · usado {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}
                {c.max_uses_per_user ? ` · ${c.max_uses_per_user}x por usuário` : ""}
              </p>
              {(c.allowed_user_ids || []).length > 0 && (
                <p className="text-[10px] text-ozx-primary mt-1 flex items-center gap-1" data-testid={`coupon-restricted-${c.code}`}>
                  <Users className="w-3 h-3" /> Restrito a {c.allowed_user_ids.length} usuário{c.allowed_user_ids.length !== 1 ? "s" : ""}
                  {(c.allowed_users || []).length > 0 && <span className="text-ozx-muted">· {(c.allowed_users || []).slice(0, 3).map((u) => u.email).join(", ")}{(c.allowed_users || []).length > 3 ? "..." : ""}</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!c.is_active && <span className="text-xs text-ozx-danger">inativo</span>}
              <Button size="sm" variant="outline" className="border-white/15" onClick={() => edit(c)} data-testid={`coupon-edit-${c.code}`}><Edit3 className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" className="border-ozx-danger/40 text-ozx-danger" onClick={() => del(c.coupon_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-ozx-muted text-sm">Nenhum cupom criado.</p>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Plus, Trash2, Upload, Search } from "lucide-react";
import { toast } from "sonner";

function maskCpf(v) {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1-$2");
}

export default function AdminCpfDiscounts() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [openSingle, setOpenSingle] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [single, setSingle] = useState({ cpf: "", discount_percent: 5, description: "" });
  const [bulk, setBulk] = useState({ cpfs: "", discount_percent: 5, description: "" });

  const load = async () => {
    try {
      const { data } = await api.get("/admin/cpf-discounts");
      setItems(data);
    } catch (e) {
      toast.error("Erro ao carregar lista de CPFs");
    }
  };
  useEffect(() => { load(); }, []);

  const createOne = async () => {
    try {
      await api.post("/admin/cpf-discounts", { ...single, discount_percent: Number(single.discount_percent) });
      toast.success("CPF adicionado");
      setSingle({ cpf: "", discount_percent: 5, description: "" });
      setOpenSingle(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao salvar");
    }
  };

  const createBulk = async () => {
    const cpfs = bulk.cpfs.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!cpfs.length) { toast.error("Cole pelo menos um CPF"); return; }
    try {
      const { data } = await api.post("/admin/cpf-discounts/bulk", {
        cpfs,
        discount_percent: Number(bulk.discount_percent),
        description: bulk.description,
      });
      toast.success(`${data.added} CPFs adicionados. ${data.skipped_invalid.length} inválidos, ${data.skipped_duplicate.length} duplicados.`);
      setBulk({ cpfs: "", discount_percent: 5, description: "" });
      setOpenBulk(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro no import em lote");
    }
  };

  const toggle = async (item) => {
    try {
      await api.put(`/admin/cpf-discounts/${item.cpf_discount_id}`, { is_active: !item.is_active });
      load();
    } catch (e) { toast.error("Erro ao alterar"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir este CPF da lista de descontos?")) return;
    try {
      await api.delete(`/admin/cpf-discounts/${id}`);
      toast.success("Removido");
      load();
    } catch (e) { toast.error("Erro ao remover"); }
  };

  const filtered = items.filter((i) => {
    if (!search) return true;
    const s = search.replace(/\D/g, "");
    return i.cpf.includes(s) || (i.description || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Marketing</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Descontos por CPF</h1>
          <p className="text-sm text-ozx-muted mt-2 max-w-2xl">
            Cadastre CPFs que ganham desconto automático no checkout. Útil para alunos de treinamentos anteriores,
            convidados VIP, ex-colaboradores etc.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenBulk(true)} variant="outline" className="border-white/15 text-white" data-testid="cpfd-bulk-btn">
            <Upload className="w-4 h-4 mr-2" /> Importar lista
          </Button>
          <Button onClick={() => setOpenSingle(true)} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="cpfd-add-btn">
            <Plus className="w-4 h-4 mr-2" /> Adicionar CPF
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ozx-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por CPF ou descrição..."
            className="bg-white/5 border-white/10 text-white pl-10"
            data-testid="cpfd-search"
          />
        </div>
        <p className="text-xs text-ozx-muted mt-2">
          {filtered.length} CPF{filtered.length !== 1 ? "s" : ""} cadastrado{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-ozx-muted uppercase text-xs">
            <tr>
              <th className="text-left px-5 py-3">CPF</th>
              <th className="text-left px-5 py-3">Descrição</th>
              <th className="text-center px-5 py-3">Desconto</th>
              <th className="text-center px-5 py-3">Usado</th>
              <th className="text-center px-5 py-3">Ativo</th>
              <th className="text-right px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-ozx-muted px-5 py-10">Nenhum CPF cadastrado ainda. Use os botões acima para começar.</td></tr>
            ) : filtered.map((i) => (
              <tr key={i.cpf_discount_id} className="border-t border-white/5 hover:bg-white/[0.03]" data-testid={`cpfd-row-${i.cpf_discount_id}`}>
                <td className="px-5 py-3 font-mono">{maskCpf(i.cpf)}</td>
                <td className="px-5 py-3 text-ozx-muted max-w-xs truncate">{i.description || "—"}</td>
                <td className="px-5 py-3 text-center text-ozx-primary font-semibold">{i.discount_percent}%</td>
                <td className="px-5 py-3 text-center text-ozx-muted">{i.used_count || 0}x</td>
                <td className="px-5 py-3 text-center">
                  <Switch checked={i.is_active} onCheckedChange={() => toggle(i)} data-testid={`cpfd-toggle-${i.cpf_discount_id}`} />
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="ghost" className="text-ozx-danger hover:text-ozx-danger hover:bg-ozx-danger/10" onClick={() => remove(i.cpf_discount_id)} data-testid={`cpfd-delete-${i.cpf_discount_id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Single add dialog */}
      <Dialog open={openSingle} onOpenChange={setOpenSingle}>
        <DialogContent className="bg-ozx-bg2 border-white/10 text-white">
          <DialogHeader><DialogTitle>Adicionar CPF</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">CPF</Label>
              <Input
                value={single.cpf}
                onChange={(e) => setSingle({ ...single, cpf: maskCpf(e.target.value) })}
                placeholder="000.000.000-00"
                className="bg-white/5 border-white/10 text-white"
                data-testid="cpfd-single-cpf"
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Desconto (%)</Label>
              <Input
                type="number" min="0.1" max="100" step="0.1"
                value={single.discount_percent}
                onChange={(e) => setSingle({ ...single, discount_percent: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                data-testid="cpfd-single-pct"
              />
            </div>
            <div>
              <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Descrição (opcional)</Label>
              <Input
                value={single.description}
                onChange={(e) => setSingle({ ...single, description: e.target.value })}
                placeholder="Ex: Aluno treinamento Out/2025"
                className="bg-white/5 border-white/10 text-white"
                data-testid="cpfd-single-desc"
              />
            </div>
            <Button onClick={createOne} className="w-full bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="cpfd-single-save">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk add dialog */}
      <Dialog open={openBulk} onOpenChange={setOpenBulk}>
        <DialogContent className="bg-ozx-bg2 border-white/10 text-white max-w-2xl">
          <DialogHeader><DialogTitle>Importar lista de CPFs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Cole os CPFs (1 por linha)</Label>
              <Textarea
                value={bulk.cpfs}
                onChange={(e) => setBulk({ ...bulk, cpfs: e.target.value })}
                rows={10}
                placeholder={"123.456.789-09\n987.654.321-00\n00000000191\n..."}
                className="bg-white/5 border-white/10 text-white font-mono text-sm"
                data-testid="cpfd-bulk-cpfs"
              />
              <p className="text-xs text-ozx-muted mt-2">
                Pode colar com ou sem máscara. CPFs inválidos ou duplicados são ignorados automaticamente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Desconto (%) para todos</Label>
                <Input
                  type="number" min="0.1" max="100" step="0.1"
                  value={bulk.discount_percent}
                  onChange={(e) => setBulk({ ...bulk, discount_percent: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="cpfd-bulk-pct"
                />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Descrição (opcional)</Label>
                <Input
                  value={bulk.description}
                  onChange={(e) => setBulk({ ...bulk, description: e.target.value })}
                  placeholder="Ex: Treinamento Out/2025"
                  className="bg-white/5 border-white/10 text-white"
                  data-testid="cpfd-bulk-desc"
                />
              </div>
            </div>
            <Button onClick={createBulk} className="w-full bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="cpfd-bulk-save">
              Importar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

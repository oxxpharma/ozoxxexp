import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";
import ImageUpload from "../../components/ImageUpload";
import { Plus, Trash2, Save, X } from "lucide-react";

const emptySpeaker = { name: "", description: "", photo_url: "", order: 0, is_active: true };

export default function AdminSpeakers() {
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptySpeaker);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/speakers");
      setSpeakers(r.data || []);
    } catch (e) {
      toast.error("Erro ao carregar palestrantes");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.name.trim()) { toast.error("Informe o nome"); return; }
    try {
      await api.post("/admin/speakers", draft);
      toast.success("Palestrante criado");
      setDraft(emptySpeaker);
      setCreating(false);
      load();
    } catch (e) {
      toast.error("Erro ao criar palestrante");
    }
  };

  const update = async (sp) => {
    try {
      await api.put(`/admin/speakers/${sp.speaker_id}`, {
        name: sp.name,
        description: sp.description,
        photo_url: sp.photo_url,
        order: Number(sp.order) || 0,
        is_active: sp.is_active,
      });
      toast.success("Palestrante atualizado");
      load();
    } catch (e) {
      toast.error("Erro ao atualizar");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir este palestrante?")) return;
    try {
      await api.delete(`/admin/speakers/${id}`);
      toast.success("Excluído");
      load();
    } catch (e) {
      toast.error("Erro ao excluir");
    }
  };

  const updateField = (idx, field, value) => {
    const arr = [...speakers];
    arr[idx] = { ...arr[idx], [field]: value };
    setSpeakers(arr);
  };

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Conteúdo</p>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-4xl font-medium tracking-tight">Palestrantes</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="speaker-add-btn">
            <Plus className="w-4 h-4 mr-2" /> Adicionar
          </Button>
        )}
      </div>

      {creating && (
        <div className="glass-card rounded-3xl p-6 mb-6" data-testid="speaker-create-form">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-medium">Novo palestrante</h2>
            <button onClick={() => { setCreating(false); setDraft(emptySpeaker); }} className="text-ozx-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <ImageUpload label="Foto" value={draft.photo_url} onChange={(v) => setDraft({ ...draft, photo_url: v })} testId="speaker-create-photo" />
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Nome</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="speaker-create-name" />
              </div>
              <div>
                <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Descrição</Label>
                <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="bg-white/5 border-white/10 text-white" data-testid="speaker-create-desc" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Ordem</Label>
                  <Input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })} className="bg-white/5 border-white/10 text-white" data-testid="speaker-create-order" />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} data-testid="speaker-create-active" />
                  <Label className="text-sm text-ozx-muted">Ativo</Label>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={create} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="speaker-create-save">
              <Save className="w-4 h-4 mr-2" /> Salvar
            </Button>
            <Button onClick={() => { setCreating(false); setDraft(emptySpeaker); }} variant="ghost" className="text-ozx-muted">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-ozx-muted">Carregando...</p>
      ) : speakers.length === 0 ? (
        <p className="text-ozx-muted">Nenhum palestrante cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {speakers.map((sp, idx) => (
            <div key={sp.speaker_id} className="glass-card rounded-3xl p-5" data-testid={`speaker-row-${sp.speaker_id}`}>
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-5 items-start">
                <ImageUpload label="" value={sp.photo_url} onChange={(v) => updateField(idx, "photo_url", v)} testId={`speaker-photo-${sp.speaker_id}`} />
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs uppercase text-ozx-muted mb-1 block">Nome</Label>
                    <Input value={sp.name} onChange={(e) => updateField(idx, "name", e.target.value)} className="bg-white/5 border-white/10 text-white" data-testid={`speaker-name-${sp.speaker_id}`} />
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-ozx-muted mb-1 block">Descrição</Label>
                    <Textarea value={sp.description || ""} onChange={(e) => updateField(idx, "description", e.target.value)} rows={2} className="bg-white/5 border-white/10 text-white" data-testid={`speaker-desc-${sp.speaker_id}`} />
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <Label className="text-xs uppercase text-ozx-muted mb-1 block">Ordem</Label>
                      <Input type="number" value={sp.order || 0} onChange={(e) => updateField(idx, "order", Number(e.target.value) || 0)} className="bg-white/5 border-white/10 text-white w-24" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Switch checked={sp.is_active} onCheckedChange={(v) => updateField(idx, "is_active", v)} />
                      <Label className="text-sm text-ozx-muted">Ativo</Label>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => update(sp)} size="sm" className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid={`speaker-save-${sp.speaker_id}`}>
                    <Save className="w-4 h-4 mr-1" /> Salvar
                  </Button>
                  <Button onClick={() => remove(sp.speaker_id)} size="sm" variant="ghost" className="text-ozx-danger hover:text-ozx-danger hover:bg-ozx-danger/10" data-testid={`speaker-delete-${sp.speaker_id}`}>
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

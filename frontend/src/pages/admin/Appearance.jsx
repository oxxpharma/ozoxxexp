import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import ImageUpload from "../../components/ImageUpload";
import { Plus, X } from "lucide-react";

export default function Appearance() {
  const [data, setData] = useState(null);
  const [faq, setFaq] = useState("");

  useEffect(() => {
    api.get("/admin/appearance").then((r) => { setData(r.data); setFaq(JSON.stringify(r.data.faq || [], null, 2)); });
  }, []);

  const save = async () => {
    let parsedFaq = data.faq;
    try { parsedFaq = JSON.parse(faq); } catch { toast.error("FAQ não é JSON válido"); return; }
    await api.put("/admin/appearance", { ...data, faq: parsedFaq });
    toast.success("Aparência atualizada");
  };

  if (!data) return <p className="text-ozx-muted">Carregando...</p>;
  const set = (k, v) => setData({ ...data, [k]: v });
  const updateGallery = (idx, val) => {
    const arr = [...(data.gallery_images || [])]; arr[idx] = val; set("gallery_images", arr);
  };
  const removeGallery = (idx) => { const arr = [...data.gallery_images]; arr.splice(idx, 1); set("gallery_images", arr); };
  const addGallery = () => set("gallery_images", [...(data.gallery_images || []), ""]);

  return (
    <div className="max-w-4xl">
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Configuração</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Aparência</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="glass-card rounded-3xl p-5">
          <ImageUpload label="Logo" value={data.logo_url} onChange={(v) => set("logo_url", v)} testId="appearance-logo" />
          <div className="mt-4">
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Tamanho do logo (altura em px)</Label>
            <Input type="number" min="20" max="80" value={data.logo_size || 32} onChange={(e) => set("logo_size", Number(e.target.value))} className="bg-white/5 border-white/10 text-white" data-testid="appearance-logo-size" />
            <p className="text-xs text-ozx-muted mt-1">Recomendado entre 28 e 60. Valor atual: {data.logo_size || 32}px</p>
          </div>
        </div>
        <div className="glass-card rounded-3xl p-5">
          <ImageUpload label="Imagem hero (fundo)" value={data.hero_image_url} onChange={(v) => set("hero_image_url", v)} testId="appearance-hero" />
        </div>
        <div className="glass-card rounded-3xl p-5 md:col-span-2">
          <ImageUpload label="Imagem ao lado do título (hero)" value={data.hero_side_image_url} onChange={(v) => set("hero_side_image_url", v)} testId="appearance-hero-side" />
          <p className="text-xs text-ozx-muted mt-2">Aparece ao lado de "Ozoxx Experience" no topo da landing. Ideal: imagem com fundo transparente (PNG).</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 mb-6">
        <Label className="text-xs uppercase text-ozx-muted mb-3 block">Galeria de fotos</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(data.gallery_images || []).map((src, i) => (
            <div key={i} className="relative">
              <ImageUpload label="" value={src} onChange={(v) => updateGallery(i, v)} testId={`gallery-${i}`} />
              <button onClick={() => removeGallery(i)} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-ozx-danger text-white flex items-center justify-center text-xs"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <button onClick={addGallery} className="h-32 glass-card rounded-2xl border-dashed flex items-center justify-center text-ozx-muted hover:text-white"><Plus className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="space-y-5 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Primária</Label>
          <Input value={data.primary_color} onChange={(e) => set("primary_color", e.target.value)} className="bg-white/5 border-white/10 text-white" /></div>
          <div><Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Secundária</Label>
          <Input value={data.secondary_color} onChange={(e) => set("secondary_color", e.target.value)} className="bg-white/5 border-white/10 text-white" /></div>
          <div><Label className="text-xs uppercase text-ozx-muted mb-1.5 block">Fundo</Label>
          <Input value={data.background_color} onChange={(e) => set("background_color", e.target.value)} className="bg-white/5 border-white/10 text-white" /></div>
        </div>
        <div>
          <Label className="text-xs uppercase text-ozx-muted mb-1.5 block">FAQ (JSON: [&#123;q,a&#125;])</Label>
          <Textarea value={faq} onChange={(e) => setFaq(e.target.value)} rows={8} className="bg-white/5 border-white/10 text-white font-mono text-xs" />
        </div>
      </div>

      <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full px-8 py-5" data-testid="appearance-save">Salvar</Button>
    </div>
  );
}

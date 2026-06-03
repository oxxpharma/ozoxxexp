import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";

export default function Appearance() {
  const [data, setData] = useState(null);
  const [gallery, setGallery] = useState("");
  const [faq, setFaq] = useState("");

  useEffect(() => {
    api.get("/admin/appearance").then((r) => {
      setData(r.data);
      setGallery((r.data.gallery_images || []).join("\n"));
      setFaq(JSON.stringify(r.data.faq || [], null, 2));
    });
  }, []);

  const save = async () => {
    let parsedFaq = data.faq;
    try { parsedFaq = JSON.parse(faq); } catch { toast.error("FAQ não é JSON válido"); return; }
    const payload = {
      ...data,
      gallery_images: gallery.split("\n").map((s) => s.trim()).filter(Boolean),
      faq: parsedFaq,
    };
    await api.put("/admin/appearance", payload);
    toast.success("Aparência atualizada");
  };

  if (!data) return <p className="text-ozx-muted">Carregando...</p>;
  const set = (k) => (e) => setData({ ...data, [k]: e.target.value });

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Configuração</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Aparência</h1>

      <div className="space-y-5">
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">URL do Logo</Label>
          <Input value={data.logo_url || ""} onChange={set("logo_url")} className="bg-white/5 border-white/10 text-white" data-testid="appearance-logo-url" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Imagem hero (URL)</Label>
          <Input value={data.hero_image_url || ""} onChange={set("hero_image_url")} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Cor primária</Label>
            <Input value={data.primary_color} onChange={set("primary_color")} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Cor secundária</Label>
            <Input value={data.secondary_color} onChange={set("secondary_color")} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Cor de fundo</Label>
            <Input value={data.background_color} onChange={set("background_color")} className="bg-white/5 border-white/10 text-white" />
          </div>
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Galeria (uma URL por linha)</Label>
          <Textarea value={gallery} onChange={(e) => setGallery(e.target.value)} rows={5} className="bg-white/5 border-white/10 text-white font-mono text-xs" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">FAQ (JSON: [&#123;q,a&#125;])</Label>
          <Textarea value={faq} onChange={(e) => setFaq(e.target.value)} rows={10} className="bg-white/5 border-white/10 text-white font-mono text-xs" />
        </div>
        <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full px-8 py-5" data-testid="appearance-save">
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

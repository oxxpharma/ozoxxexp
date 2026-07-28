import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";

export default function EventConfig() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/event").then((r) => setData(r.data)); }, []);

  const set = (k) => (e) => setData({ ...data, [k]: e.target.value });
  const save = async () => {
    await api.put("/admin/event", data);
    toast.success("Evento atualizado");
  };
  if (!data) return <p className="text-ozx-muted">Carregando...</p>;

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Evento</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Configurar evento</h1>

      <div className="space-y-5">
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Nome</Label>
          <Input value={data.name} onChange={set("name")} className="bg-white/5 border-white/10 text-white" data-testid="event-name" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Início (ISO)</Label>
            <Input value={data.start_date} onChange={set("start_date")} className="bg-white/5 border-white/10 text-white" data-testid="event-start" />
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Fim (ISO)</Label>
            <Input value={data.end_date} onChange={set("end_date")} className="bg-white/5 border-white/10 text-white" data-testid="event-end" />
          </div>
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Nome do local</Label>
          <Input value={data.location_name} onChange={set("location_name")} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Endereço</Label>
          <Input value={data.location_address} onChange={set("location_address")} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Cidade (destaque na hero)</Label>
          <Input value={data.location_city || ""} onChange={set("location_city")} placeholder="São Paulo" className="bg-white/5 border-white/10 text-white" data-testid="event-location-city" />
          <p className="text-xs text-ozx-muted mt-1">Aparece em destaque, logo abaixo do título &quot;Ozoxx Experience&quot;.</p>
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Descrição</Label>
          <Textarea value={data.description} onChange={set("description")} rows={4} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Headline (hero)</Label>
          <Input value={data.hero_headline} onChange={set("hero_headline")} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Subheadline (hero)</Label>
          <Textarea value={data.hero_subheadline} onChange={set("hero_subheadline")} rows={2} className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Pitch curto (badge)</Label>
          <Input value={data.short_pitch} onChange={set("short_pitch")} className="bg-white/5 border-white/10 text-white" />
        </div>
        <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full px-8 py-5" data-testid="event-save">
          Salvar
        </Button>
      </div>
    </div>
  );
}

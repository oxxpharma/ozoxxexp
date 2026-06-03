import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Send, FileText, History } from "lucide-react";
import { toast } from "sonner";

export default function AdminEmails() {
  const [tab, setTab] = useState("send");
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState({ subject: "", html: "", recipients: "all", template_id: "" });
  const [editing, setEditing] = useState({ template_id: null, name: "", subject: "", html: "", description: "" });

  const load = async () => {
    const [t, l] = await Promise.all([api.get("/admin/emails/templates"), api.get("/admin/emails/logs")]);
    setTemplates(t.data); setLogs(l.data);
  };
  useEffect(() => { load(); }, []);

  const useTemplate = (id) => {
    const t = templates.find((x) => x.template_id === id);
    if (t) setForm({ ...form, subject: t.subject, html: t.html, template_id: id });
  };

  const send = async () => {
    if (!form.subject || !form.html) return toast.error("Assunto e conteúdo obrigatórios");
    try {
      const { data } = await api.post("/admin/emails/send", form);
      toast.success(`Enviados: ${data.sent} · Falhas: ${data.failed} · Total: ${data.total}`);
      load();
    } catch (e) { toast.error("Erro"); }
  };

  const saveTemplate = async () => {
    try {
      if (editing.template_id) {
        await api.put(`/admin/emails/templates/${editing.template_id}`, { name: editing.name, subject: editing.subject, html: editing.html, description: editing.description });
      } else {
        await api.post("/admin/emails/templates", { name: editing.name, subject: editing.subject, html: editing.html, description: editing.description });
      }
      toast.success("Salvo");
      setEditing({ template_id: null, name: "", subject: "", html: "", description: "" });
      load();
    } catch (e) { toast.error("Erro"); }
  };

  const editTpl = (t) => setEditing({ template_id: t.template_id, name: t.name, subject: t.subject, html: t.html, description: t.description || "" });

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Marketing</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Central de E-mails</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 mb-6">
          <TabsTrigger value="send" data-testid="email-tab-send"><Send className="w-4 h-4 mr-2" /> Enviar</TabsTrigger>
          <TabsTrigger value="templates" data-testid="email-tab-templates"><FileText className="w-4 h-4 mr-2" /> Templates</TabsTrigger>
          <TabsTrigger value="logs" data-testid="email-tab-logs"><History className="w-4 h-4 mr-2" /> Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <div className="glass-card rounded-3xl p-6 lg:p-8 max-w-3xl space-y-4">
            <div>
              <Label className="text-xs uppercase text-ozx-muted">Carregar template (opcional)</Label>
              <Select value={form.template_id} onValueChange={useTemplate}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                  {templates.map((t) => <SelectItem key={t.template_id} value={t.template_id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-ozx-muted">Destinatários</Label>
              <Select value={form.recipients} onValueChange={(v) => setForm({ ...form, recipients: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="email-recipients"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                  <SelectItem value="all">Todos os usuários cadastrados</SelectItem>
                  <SelectItem value="paid_customers">Clientes que pagaram</SelectItem>
                  <SelectItem value="leaders">Apenas líderes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase text-ozx-muted">Assunto</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="bg-white/5 border-white/10 text-white" data-testid="email-subject" /></div>
            <div><Label className="text-xs uppercase text-ozx-muted">HTML do e-mail</Label>
            <Textarea value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} rows={12} className="bg-white/5 border-white/10 text-white font-mono text-xs" data-testid="email-html" />
            <p className="text-xs text-ozx-muted mt-1">Use variáveis: <code className="text-ozx-primary">{`{{name}}`}</code>, <code className="text-ozx-primary">{`{{email}}`}</code>, <code className="text-ozx-primary">{`{{site_url}}`}</code></p></div>
            <Button onClick={send} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full px-8" data-testid="email-send"><Send className="w-4 h-4 mr-2" /> Enviar agora</Button>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-2">
              <Button onClick={() => setEditing({ template_id: null, name: "", subject: "", html: "", description: "" })} variant="outline" className="border-white/15 w-full">+ Novo template</Button>
              {templates.map((t) => (
                <button key={t.template_id} onClick={() => editTpl(t)} className={`w-full text-left p-3 rounded-xl glass-card hover:border-ozx-primary/30 transition ${editing.template_id === t.template_id ? "border-ozx-primary/40" : ""}`} data-testid={`tpl-${t.template_id}`}>
                  <p className="text-sm font-display">{t.name}</p>
                  <p className="text-xs text-ozx-muted truncate">{t.subject}</p>
                </button>
              ))}
            </div>
            <div className="lg:col-span-2 glass-card rounded-3xl p-6 space-y-3">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome do template" className="bg-white/5 border-white/10 text-white" />
              <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Assunto" className="bg-white/5 border-white/10 text-white" />
              <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Descrição (interna)" className="bg-white/5 border-white/10 text-white" />
              <Textarea value={editing.html} onChange={(e) => setEditing({ ...editing, html: e.target.value })} rows={14} placeholder="<div>...</div>" className="bg-white/5 border-white/10 text-white font-mono text-xs" />
              <Button onClick={saveTemplate} className="bg-ozx-primary text-ozx-bg">{editing.template_id ? "Atualizar" : "Criar"} template</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-ozx-muted text-xs uppercase tracking-wider">
                <tr><th className="text-left px-4 py-3">Data</th><th className="text-left px-4 py-3">Para</th><th className="text-left px-4 py-3">Assunto</th><th className="text-left px-4 py-3">Status</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.log_id} className="border-t border-white/5">
                    <td className="px-4 py-2 text-xs text-ozx-muted">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">{l.to}</td>
                    <td className="px-4 py-2 truncate max-w-xs">{l.subject}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${l.status === "sent" ? "bg-ozx-success/15 text-ozx-success" : l.status === "failed" ? "bg-ozx-danger/15 text-ozx-danger" : "bg-white/10 text-ozx-muted"}`}>{l.status}</span></td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-ozx-muted">Sem logs ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

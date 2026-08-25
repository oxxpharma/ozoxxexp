import { useEffect, useState } from "react";
import api from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Zap, CreditCard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

export default function Integrations() {
  const [data, setData] = useState(null);
  const [pbResult, setPbResult] = useState(null);
  const [reResult, setReResult] = useState(null);

  useEffect(() => { api.get("/admin/integrations").then((r) => setData(r.data)); }, []);
  if (!data) return <p className="text-ozx-muted">Carregando...</p>;
  const set = (k) => (e) => setData({ ...data, [k]: e.target.value });

  const save = async () => { await api.put("/admin/integrations", data); toast.success("Salvo"); };
  const testPagBank = async () => {
    await save();
    const { data: res } = await api.post("/admin/integrations/test-pagbank");
    setPbResult(res);
    res.success ? toast.success(res.message) : toast.error(res.message);
  };
  const testResend = async () => {
    await save();
    const { data: res } = await api.post("/admin/integrations/test-resend");
    setReResult(res);
    res.success ? toast.success(res.message) : toast.error(res.message);
  };

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Integrações</p>
      <h1 className="font-display text-4xl font-medium tracking-tight mb-8">APIs externas</h1>

      {/* Gateway selector */}
      <div className="glass-card rounded-3xl p-6 lg:p-8 mb-6 border border-ozx-primary/30" data-testid="gateway-selector">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-ozx-primary" />
          <h2 className="font-display text-2xl">Gateway de pagamento ativo</h2>
        </div>
        <p className="text-xs text-ozx-muted mb-4">Escolha qual processador será usado nos novos pedidos. Ambos podem ficar configurados; só o selecionado processa cobranças.</p>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select value={data.payment_gateway || "pagbank"} onValueChange={(v) => setData({ ...data, payment_gateway: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white sm:max-w-xs" data-testid="gateway-select"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-ozx-bg2 text-white border-white/10">
              <SelectItem value="pagbank">PagBank / PagSeguro</SelectItem>
              <SelectItem value="asaas">Asaas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="gateway-save">Salvar seleção</Button>
        </div>
      </div>

      {/* PagBank */}
      <div className="glass-card rounded-3xl p-6 lg:p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl">PagBank / PagSeguro</h2>
            <p className="text-xs text-ozx-muted">Processa pagamentos PIX e cartão</p>
          </div>
          {pbResult && (
            <span className={`flex items-center gap-1.5 text-xs ${pbResult.success ? "text-ozx-success" : "text-ozx-danger"}`}>
              {pbResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {pbResult.success ? "Conectado" : "Falha"}
            </span>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Token PagBank</Label>
            <Input type="password" value={data.pagbank_token || ""} onChange={set("pagbank_token")} className="bg-white/5 border-white/10 text-white font-mono" placeholder="Bearer token" data-testid="pagbank-token" />
            <p className="text-xs text-ozx-muted mt-1">PagBank → Vendas Online → Integrações → Token de Segurança</p>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">E-mail da conta PagBank</Label>
            <Input value={data.pagbank_email || ""} onChange={set("pagbank_email")} className="bg-white/5 border-white/10 text-white" data-testid="pagbank-email" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div>
              <p className="text-sm">Ambiente Sandbox (testes)</p>
              <p className="text-xs text-ozx-muted">Desative para produção</p>
            </div>
            <Switch checked={data.pagbank_sandbox} onCheckedChange={(v) => setData({ ...data, pagbank_sandbox: v })} data-testid="pagbank-sandbox" />
          </div>

          {/* V2 toggle removido — sua conta PagBank não tem o produto V2 habilitado.
              Vamos seguir com a homologação da API v4. */}
          <div className="flex gap-3">
            <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="pagbank-save">Salvar</Button>
            <Button onClick={testPagBank} variant="outline" className="border-white/15 text-white rounded-full" data-testid="pagbank-test">
              <Zap className="w-4 h-4 mr-2" /> Testar conexão
            </Button>
          </div>
        </div>
      </div>

      {/* Asaas */}
      <div className="glass-card rounded-3xl p-6 lg:p-8 mb-6" data-testid="asaas-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl">Asaas</h2>
            <p className="text-xs text-ozx-muted">Gateway alternativo — checkout hospedado (PIX + cartão 10x sem juros)</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Ambiente ativo</Label>
              <Select value={data.asaas_environment || "sandbox"} onValueChange={(v) => setData({ ...data, asaas_environment: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="asaas-env"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Access Token — Sandbox</Label>
            <Input type="password" value={data.asaas_sandbox_token || ""} onChange={set("asaas_sandbox_token")} className="bg-white/5 border-white/10 text-white font-mono" placeholder="$aact_hmlg_..." data-testid="asaas-sandbox-token" />
            <p className="text-xs text-ozx-muted mt-1">Painel Asaas Sandbox → Integrações → gerar API Key</p>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Access Token — Produção</Label>
            <Input type="password" value={data.asaas_production_token || ""} onChange={set("asaas_production_token")} className="bg-white/5 border-white/10 text-white font-mono" placeholder="$aact_prod_..." data-testid="asaas-production-token" />
            <p className="text-xs text-ozx-muted mt-1">Só necessário quando ambiente = Produção</p>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Webhook Auth Token</Label>
            <Input type="password" value={data.asaas_webhook_token || ""} onChange={set("asaas_webhook_token")} className="bg-white/5 border-white/10 text-white font-mono" placeholder="segredo de 32+ caracteres" data-testid="asaas-webhook-token" />
            <p className="text-xs text-ozx-muted mt-1">Segredo compartilhado — Asaas envia no header <code>asaas-access-token</code>. Diferente do Access Token da API.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="asaas-save">Salvar</Button>
            <Button
              variant="outline"
              className="border-white/15 text-white rounded-full"
              data-testid="asaas-register-webhook"
              onClick={async () => {
                await save();
                try {
                  const { data: res } = await api.post("/admin/asaas/register-webhook");
                  res.success ? toast.success("Webhook registrado no Asaas") : toast.error(res.data?.error || "Falha ao registrar");
                } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
              }}
            >
              <Zap className="w-4 h-4 mr-2" /> Registrar webhook no Asaas
            </Button>
          </div>
          <p className="text-[10px] text-ozx-muted">URL do webhook: <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/asaas</code></p>
        </div>
      </div>

      {/* Resend */}
      <div className="glass-card rounded-3xl p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl">Resend</h2>
            <p className="text-xs text-ozx-muted">Envio de e-mails transacionais (credenciais)</p>
          </div>
          {reResult && (
            <span className={`flex items-center gap-1.5 text-xs ${reResult.success ? "text-ozx-success" : "text-ozx-danger"}`}>
              {reResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {reResult.success ? "Conectado" : "Falha"}
            </span>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">API Key Resend</Label>
            <Input type="password" value={data.resend_api_key || ""} onChange={set("resend_api_key")} className="bg-white/5 border-white/10 text-white font-mono" placeholder="re_..." data-testid="resend-key" />
            <p className="text-xs text-ozx-muted mt-1">Obtenha em https://resend.com/api-keys</p>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">E-mail remetente</Label>
            <Input value={data.resend_sender || ""} onChange={set("resend_sender")} className="bg-white/5 border-white/10 text-white" placeholder="contato@ozoxx.com" data-testid="resend-sender" />
          </div>
          <div className="flex gap-3">
            <Button onClick={save} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="resend-save">Salvar</Button>
            <Button onClick={testResend} variant="outline" className="border-white/15 text-white rounded-full" data-testid="resend-test">
              <Zap className="w-4 h-4 mr-2" /> Testar conexão
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Users, User, Check } from "lucide-react";
import Navbar from "../components/Navbar";

function formatErr(d) {
  if (!d) return "Erro";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return d?.msg || JSON.stringify(d);
}

export default function Checkout() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(params.get("ticket") || "");
  const [hasCompanion, setHasCompanion] = useState(false);
  const [companion, setCompanion] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [holder, setHolder] = useState({ holder_name: "", holder_email: "", holder_cpf: "", holder_phone: "" });
  const [method, setMethod] = useState("pix");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/public/tickets").then((r) => {
      setTickets(r.data);
      if (!selected && r.data.length) setSelected(r.data[0].ticket_type_id);
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (user) {
      setHolder({
        holder_name: user.name || "",
        holder_email: user.email || "",
        holder_cpf: user.cpf || "",
        holder_phone: user.phone || "",
      });
    }
  }, [user]);

  const ticket = tickets.find((t) => t.ticket_type_id === selected);
  const qty = hasCompanion ? 2 : 1;
  const total = ticket ? Number(ticket.price) * qty : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!ticket) return;
    setLoading(true);
    try {
      const payload = {
        ticket_type_id: ticket.ticket_type_id,
        has_companion: hasCompanion,
        companion: hasCompanion ? companion : null,
        payment_method: method,
        ...holder,
      };
      const { data } = await api.post("/orders", payload);
      toast.success("Pedido criado! Finalize o pagamento.");
      navigate(`/payment/${data.order_id}`);
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Erro ao criar pedido");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-ozx-bg">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 lg:px-12 pt-28 pb-16">
        <button onClick={() => navigate(-1)} className="text-ozx-muted hover:text-white text-sm flex items-center gap-2 mb-8" data-testid="checkout-back">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Checkout</p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">Garantir ingresso</h1>
        </motion.div>

        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">1. Ingresso</h2>
              <RadioGroup value={selected} onValueChange={setSelected} className="space-y-3" data-testid="checkout-tickets">
                {tickets.map((t) => (
                  <label key={t.ticket_type_id} className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition ${selected === t.ticket_type_id ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10 hover:border-white/20"}`}>
                    <RadioGroupItem value={t.ticket_type_id} className="mt-1" data-testid={`ticket-radio-${t.ticket_type_id}`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-display text-lg">{t.name}</p>
                          <p className="text-sm text-ozx-muted">{t.description}</p>
                        </div>
                        <p className="font-display text-xl">R$ {Number(t.price).toFixed(2).replace(".", ",")}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">2. Titular</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-ozx-muted">Nome</Label>
                  <Input required value={holder.holder_name} onChange={(e) => setHolder({ ...holder, holder_name: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-holder-name" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-ozx-muted">E-mail</Label>
                  <Input required type="email" value={holder.holder_email} onChange={(e) => setHolder({ ...holder, holder_email: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-holder-email" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-ozx-muted">CPF</Label>
                  <Input value={holder.holder_cpf} onChange={(e) => setHolder({ ...holder, holder_cpf: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-holder-cpf" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-ozx-muted">Telefone</Label>
                  <Input value={holder.holder_phone} onChange={(e) => setHolder({ ...holder, holder_phone: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" placeholder="(11) 99999-9999" data-testid="checkout-holder-phone" />
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-ozx-primary" />
                  <h2 className="font-display text-2xl">3. Acompanhante</h2>
                </div>
                <Switch checked={hasCompanion} onCheckedChange={setHasCompanion} data-testid="checkout-companion-toggle" />
              </div>
              {hasCompanion && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-ozx-muted">Nome do acompanhante</Label>
                    <Input required value={companion.name} onChange={(e) => setCompanion({ ...companion, name: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-companion-name" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-ozx-muted">E-mail do acompanhante</Label>
                    <Input required type="email" value={companion.email} onChange={(e) => setCompanion({ ...companion, email: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-companion-email" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-ozx-muted">CPF</Label>
                    <Input value={companion.cpf} onChange={(e) => setCompanion({ ...companion, cpf: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-companion-cpf" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-ozx-muted">Telefone</Label>
                    <Input value={companion.phone} onChange={(e) => setCompanion({ ...companion, phone: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid="checkout-companion-phone" />
                  </div>
                </motion.div>
              )}
              {!hasCompanion && <p className="text-sm text-ozx-muted">Ative para adicionar acompanhante. Será cobrado um ingresso adicional e gerada uma credencial separada.</p>}
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">4. Pagamento</h2>
              <RadioGroup value={method} onValueChange={setMethod} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer ${method === "pix" ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10"}`}>
                  <RadioGroupItem value="pix" data-testid="pay-pix" />
                  <div>
                    <p className="font-display">PIX</p>
                    <p className="text-xs text-ozx-muted">Aprovação imediata</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer ${method === "credit_card" ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10"}`}>
                  <RadioGroupItem value="credit_card" data-testid="pay-card" />
                  <div>
                    <p className="font-display">Cartão de Crédito</p>
                    <p className="text-xs text-ozx-muted">Via PagBank</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Resumo</p>
              <h3 className="font-display text-2xl mb-6">Seu pedido</h3>
              {ticket && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-ozx-muted text-sm">{ticket.name}</span>
                    <span>R$ {Number(ticket.price).toFixed(2).replace(".", ",")}</span>
                  </div>
                  {hasCompanion && (
                    <div className="flex justify-between">
                      <span className="text-ozx-muted text-sm">+ Acompanhante</span>
                      <span>R$ {Number(ticket.price).toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  <div className="h-px bg-white/10 my-2" />
                  <div className="flex justify-between text-lg">
                    <span>Total</span>
                    <span className="font-display text-2xl">R$ {total.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>
              )}
              <Button type="submit" disabled={loading || !ticket} className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6 mt-6" data-testid="checkout-submit">
                {loading ? "Criando pedido..." : "Confirmar e Pagar"}
              </Button>
              <p className="text-xs text-ozx-muted text-center mt-4 flex items-center gap-1.5 justify-center">
                <Check className="w-3.5 h-3.5 text-ozx-primary" /> Credencial enviada por e-mail após pagamento
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

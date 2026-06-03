import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Check, Tag, X } from "lucide-react";
import Navbar from "../components/Navbar";
import { getUTM } from "../lib/utm";

function fmt(d) { if (!d) return "Erro"; if (typeof d === "string") return d; if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" "); return d?.msg || JSON.stringify(d); }

export default function Checkout() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(params.get("ticket") || "");
  const [selectedLot, setSelectedLot] = useState("");
  const [hasCompanion, setHasCompanion] = useState(false);
  const [companion, setCompanion] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [holder, setHolder] = useState({ holder_name: "", holder_email: "", holder_cpf: "", holder_phone: "", holder_birth_date: "", holder_gender: "", holder_city: "", holder_state: "" });
  const [method, setMethod] = useState("pix");
  const [coupon, setCoupon] = useState("");
  const [couponValid, setCouponValid] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/public/config").then((r) => {
      setTickets(r.data.tickets);
      setLots(r.data.lots || []);
      if (!selectedTicket && r.data.tickets.length) setSelectedTicket(r.data.tickets[0].ticket_type_id);
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (selectedTicket) {
      const ticketLots = lots.filter((l) => l.ticket_type_id === selectedTicket && l.is_active && l.remaining > 0);
      if (ticketLots.length && !selectedLot) setSelectedLot(ticketLots[0].lot_id);
    }
  }, [selectedTicket, lots]); // eslint-disable-line

  useEffect(() => {
    if (user) setHolder({
      holder_name: user.name || "", holder_email: user.email || "", holder_cpf: user.cpf || "", holder_phone: user.phone || "",
      holder_birth_date: user.birth_date || "", holder_gender: user.gender || "", holder_city: user.city || "", holder_state: user.state || "",
    });
  }, [user]);

  const ticket = tickets.find((t) => t.ticket_type_id === selectedTicket);
  const lot = lots.find((l) => l.lot_id === selectedLot);
  const qty = hasCompanion ? 2 : 1;
  const subtotal = lot ? Number(lot.price) * qty : 0;
  let discount = 0;
  if (couponValid) {
    if (couponValid.discount_type === "percent") discount = subtotal * (couponValid.discount_value / 100);
    else discount = Math.min(subtotal, couponValid.discount_value);
  }
  const total = Math.max(0, subtotal - discount);

  const validateCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const { data } = await api.get(`/coupons/validate/${coupon.toUpperCase()}`);
      setCouponValid(data);
      toast.success(`Cupom aplicado: ${data.discount_type === "percent" ? `${data.discount_value}% off` : `R$ ${data.discount_value} off`}`);
    } catch (e) {
      setCouponValid(null);
      toast.error(e.response?.data?.detail || "Cupom inválido");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!lot) return toast.error("Selecione um lote");
    setLoading(true);
    try {
      const utm = getUTM();
      const payload = {
        ticket_type_id: ticket.ticket_type_id, lot_id: lot.lot_id,
        has_companion: hasCompanion, companion: hasCompanion ? companion : null,
        payment_method: method, coupon_code: couponValid ? couponValid.code : null,
        ...holder, utm: Object.keys(utm).length ? utm : null,
      };
      const { data } = await api.post("/orders", payload);
      toast.success("Pedido criado!");
      navigate(`/payment/${data.order_id}`);
    } catch (err) { toast.error(fmt(err.response?.data?.detail) || "Erro"); }
    finally { setLoading(false); }
  };

  const availableLots = lots.filter((l) => l.ticket_type_id === selectedTicket && l.is_active && l.remaining > 0);

  return (
    <div className="min-h-screen bg-ozx-bg">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 lg:px-12 pt-28 pb-16">
        <button onClick={() => navigate(-1)} className="text-ozx-muted hover:text-white text-sm flex items-center gap-2 mb-8"><ArrowLeft className="w-4 h-4" /> Voltar</button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Checkout</p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">Garantir ingresso</h1>
        </motion.div>

        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">1. Ingresso e lote</h2>
              <RadioGroup value={selectedTicket} onValueChange={setSelectedTicket} className="space-y-3 mb-5">
                {tickets.map((t) => (
                  <label key={t.ticket_type_id} className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition ${selectedTicket === t.ticket_type_id ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10 hover:border-white/20"}`}>
                    <RadioGroupItem value={t.ticket_type_id} className="mt-1" />
                    <div className="flex-1"><p className="font-display text-lg">{t.name}</p><p className="text-sm text-ozx-muted">{t.description}</p></div>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-xs uppercase tracking-wider text-ozx-muted mb-2">Lote</p>
              <RadioGroup value={selectedLot} onValueChange={setSelectedLot} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {availableLots.map((l) => (
                  <label key={l.lot_id} className={`p-4 rounded-2xl border cursor-pointer transition ${selectedLot === l.lot_id ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10 hover:border-white/20"}`}>
                    <RadioGroupItem value={l.lot_id} data-testid={`checkout-lot-${l.lot_id}`} />
                    <p className="font-display mt-2">{l.name}</p>
                    <p className="font-display text-2xl">R$ {Number(l.price).toFixed(2).replace(".", ",")}</p>
                    <p className="text-xs text-ozx-muted mt-1">{l.remaining} restantes</p>
                  </label>
                ))}
                {availableLots.length === 0 && <p className="text-sm text-ozx-muted col-span-3">Nenhum lote disponível.</p>}
              </RadioGroup>
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">2. Seus dados</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome completo" value={holder.holder_name} on={(v) => setHolder({ ...holder, holder_name: v })} required testId="checkout-holder-name" />
                <Field label="E-mail" type="email" value={holder.holder_email} on={(v) => setHolder({ ...holder, holder_email: v })} required testId="checkout-holder-email" />
                <Field label="Telefone" value={holder.holder_phone} on={(v) => setHolder({ ...holder, holder_phone: v })} placeholder="(11) 99999-9999" testId="checkout-holder-phone" />
                <Field label="CPF" value={holder.holder_cpf} on={(v) => setHolder({ ...holder, holder_cpf: v })} testId="checkout-holder-cpf" />
                <Field label="Data de nascimento" type="date" value={holder.holder_birth_date} on={(v) => setHolder({ ...holder, holder_birth_date: v })} />
                <div>
                  <Label className="text-xs uppercase tracking-wider text-ozx-muted">Sexo</Label>
                  <Select value={holder.holder_gender} onValueChange={(v) => setHolder({ ...holder, holder_gender: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Cidade" value={holder.holder_city} on={(v) => setHolder({ ...holder, holder_city: v })} />
                <Field label="Estado (UF)" value={holder.holder_state} on={(v) => setHolder({ ...holder, holder_state: v.toUpperCase().slice(0, 2) })} />
              </div>
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3"><Users className="w-5 h-5 text-ozx-primary" /><h2 className="font-display text-2xl">3. Acompanhante</h2></div>
                <Switch checked={hasCompanion} onCheckedChange={setHasCompanion} data-testid="checkout-companion-toggle" />
              </div>
              {hasCompanion && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nome do acompanhante" value={companion.name} on={(v) => setCompanion({ ...companion, name: v })} required />
                  <Field label="E-mail" type="email" value={companion.email} on={(v) => setCompanion({ ...companion, email: v })} required />
                  <Field label="CPF" value={companion.cpf} on={(v) => setCompanion({ ...companion, cpf: v })} />
                  <Field label="Telefone" value={companion.phone} on={(v) => setCompanion({ ...companion, phone: v })} />
                </motion.div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">4. Cupom (opcional)</h2>
              {couponValid ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-ozx-success/10 border border-ozx-success/30">
                  <div><p className="font-display text-ozx-success">{couponValid.code}</p><p className="text-xs text-ozx-muted">{couponValid.discount_type === "percent" ? `${couponValid.discount_value}% off` : `R$ ${couponValid.discount_value} off`}</p></div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setCouponValid(null); setCoupon(""); }}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Insira o código" className="bg-white/5 border-white/10 text-white" data-testid="coupon-input" />
                  <Button type="button" onClick={validateCoupon} variant="outline" className="border-ozx-primary text-ozx-primary"><Tag className="w-4 h-4 mr-2" /> Aplicar</Button>
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <h2 className="font-display text-2xl mb-4">5. Pagamento</h2>
              <RadioGroup value={method} onValueChange={setMethod} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer ${method === "pix" ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10"}`}>
                  <RadioGroupItem value="pix" /><div><p className="font-display">PIX</p><p className="text-xs text-ozx-muted">Aprovação imediata</p></div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer ${method === "credit_card" ? "border-ozx-primary bg-ozx-primary/5" : "border-white/10"}`}>
                  <RadioGroupItem value="credit_card" /><div><p className="font-display">Cartão</p><p className="text-xs text-ozx-muted">Via PagBank</p></div>
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            <div className="glass-card rounded-3xl p-6 lg:p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Resumo</p>
              <h3 className="font-display text-2xl mb-6">Seu pedido</h3>
              {lot && (
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-ozx-muted text-sm">{ticket?.name} ({lot.name})</span><span>R$ {Number(lot.price).toFixed(2).replace(".", ",")}</span></div>
                  {hasCompanion && <div className="flex justify-between"><span className="text-ozx-muted text-sm">+ Acompanhante</span><span>R$ {Number(lot.price).toFixed(2).replace(".", ",")}</span></div>}
                  {discount > 0 && <div className="flex justify-between text-ozx-success"><span className="text-sm">Desconto ({couponValid?.code})</span><span>- R$ {discount.toFixed(2).replace(".", ",")}</span></div>}
                  <div className="h-px bg-white/10 my-2" />
                  <div className="flex justify-between text-lg"><span>Total</span><span className="font-display text-2xl">R$ {total.toFixed(2).replace(".", ",")}</span></div>
                </div>
              )}
              <Button type="submit" disabled={loading || !lot} className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6 mt-6" data-testid="checkout-submit">
                {loading ? "Processando..." : "Confirmar e Pagar"}
              </Button>
              <p className="text-xs text-ozx-muted text-center mt-4 flex items-center gap-1.5 justify-center"><Check className="w-3.5 h-3.5 text-ozx-primary" /> Credencial enviada por e-mail</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, on, required, type = "text", placeholder, testId }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-ozx-muted">{label}</Label>
      <Input required={required} type={type} value={value} onChange={(e) => on(e.target.value)} placeholder={placeholder} className="bg-white/5 border-white/10 text-white mt-1.5" data-testid={testId} />
    </div>
  );
}

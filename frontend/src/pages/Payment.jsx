import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Copy, RefreshCw, CheckCircle2, AlertCircle, Clock, QrCode, ShieldCheck } from "lucide-react";
import Navbar from "../components/Navbar";

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [polling, setPolling] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const fetchOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}/refresh-status`);
      setOrder(data);
      if (data.status === "PAID") {
        setPolling(false);
        toast.success("Pagamento confirmado!");
      }
    } catch (e) {
      // best-effort
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchOrder, 0);
    if (!polling) return () => clearTimeout(t);
    const id = setInterval(fetchOrder, 6000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [orderId, polling]); // eslint-disable-line

  const retry = async () => {
    setRetrying(true);
    try {
      const { data } = await api.post(`/orders/${orderId}/retry`);
      setOrder(data);
      toast.success("Novo link de pagamento gerado");
    } catch (e) {
      toast.error("Não foi possível gerar novo pagamento");
    } finally { setRetrying(false); }
  };

  const copy = (txt) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado!");
  };

  if (!order) return <div className="min-h-screen flex items-center justify-center text-ozx-muted">Carregando...</div>;

  const isPaid = order.status === "PAID";
  const isFailed = ["DECLINED", "CANCELED"].includes(order.status);
  const isCard = order.payment_method === "credit_card";

  return (
    <div className="min-h-screen bg-ozx-bg">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Pedido {order.order_id.slice(-8)}</p>
            <h1 className="font-display text-4xl font-medium tracking-tight">Pagamento</h1>
          </div>

          {isPaid ? (
            <div className="glass-card rounded-3xl p-8 text-center" data-testid="payment-success">
              <CheckCircle2 className="w-16 h-16 text-ozx-success mx-auto mb-4" />
              <h2 className="font-display text-3xl mb-2">Pagamento confirmado!</h2>
              <p className="text-ozx-muted mb-6">Sua credencial foi gerada e enviada por e-mail.</p>
              <Button onClick={() => navigate("/dashboard")} className="bg-ozx-primary text-ozx-bg rounded-full px-8 py-5 font-semibold">
                Ver minha credencial
              </Button>
            </div>
          ) : isFailed ? (
            <div className="glass-card rounded-3xl p-8" data-testid="payment-failed">
              <AlertCircle className="w-12 h-12 text-ozx-danger mb-4" />
              <h2 className="font-display text-2xl mb-2">Pagamento não concluído</h2>
              <p className="text-ozx-muted mb-6">Você pode tentar pagar novamente sem refazer o pedido.</p>
              <Button onClick={retry} disabled={retrying} className="bg-ozx-primary text-ozx-bg rounded-full px-8 py-5 font-semibold" data-testid="payment-retry">
                <RefreshCw className="w-4 h-4 mr-2" /> {retrying ? "Gerando..." : "Tentar novamente"}
              </Button>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-8" data-testid="payment-pending">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-ozx-warning" />
                <p className="text-sm text-ozx-warning uppercase tracking-wider">Aguardando pagamento</p>
              </div>
              <h2 className="font-display text-3xl mb-6">R$ {Number(order.total_amount).toFixed(2).replace(".", ",")}</h2>

              {order.gateway === "asaas" && order.asaas_checkout_url ? (
                <AsaasRedirect order={order} onRefresh={fetchOrder} />
              ) : isCard && order.pagbank_payment_link ? (
                <div className="space-y-4" data-testid="payment-card-checkout">
                  <div className="glass-card rounded-2xl p-5 bg-ozx-primary/5 border-ozx-primary/20">
                    <p className="text-sm text-ozx-muted leading-relaxed">
                      O pagamento com <span className="text-white font-medium">cartão de crédito</span> será concluído de forma segura no ambiente do PagBank. Você poderá parcelar em até 10x sem juros.
                    </p>
                  </div>
                  <Button
                    onClick={() => { window.location.href = order.pagbank_payment_link; }}
                    className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6 text-base"
                    data-testid="payment-card-go"
                  >
                    Pagar com cartão no PagBank →
                  </Button>
                  <Button variant="ghost" className="w-full text-ozx-muted" onClick={fetchOrder} data-testid="payment-refresh-card">
                    <RefreshCw className="w-4 h-4 mr-2" /> Já paguei, atualizar status
                  </Button>
                </div>
              ) : order.pagbank_qr_code_url || order.pagbank_qr_code_text ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl p-6 flex items-center justify-center">
                    {order.pagbank_qr_code_url ? (
                      <img src={order.pagbank_qr_code_url} alt="PIX QR" className="w-full max-w-[260px]" data-testid="payment-qr-image" />
                    ) : (
                      <div className="text-ozx-bg text-center p-8">
                        <QrCode className="w-16 h-16 mx-auto mb-2" />
                        <p className="text-xs">Use o código PIX ao lado</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-ozx-muted">Pague com PIX escaneando o QR ou copiando o código:</p>
                    {order.pagbank_qr_code_text && (
                      <div className="bg-ozx-bg2 rounded-xl p-3 text-xs font-mono break-all border border-white/10">
                        {order.pagbank_qr_code_text}
                      </div>
                    )}
                    {order.pagbank_qr_code_text && (
                      <Button variant="outline" className="w-full border-white/15 text-white" onClick={() => copy(order.pagbank_qr_code_text)} data-testid="payment-copy-code">
                        <Copy className="w-4 h-4 mr-2" /> Copiar código PIX
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full text-ozx-muted" onClick={fetchOrder} data-testid="payment-refresh">
                      <RefreshCw className="w-4 h-4 mr-2" /> Atualizar status
                    </Button>
                  </div>
                </div>
              ) : (() => {
                // Classifica o erro para mostrar mensagem amigável + ação certa
                const err = (order.payment_error || "").toLowerCase();
                const isCpfError = err.includes("cpf") || err.includes("cnpj") || err.includes("tax_id");
                const isEmailError = err.includes("email") || err.includes("e-mail");
                const isPhoneError = err.includes("phone") || err.includes("telefone");
                const isDataError = isCpfError || isEmailError || isPhoneError;
                let title, hint;
                if (isCpfError) {
                  title = "CPF/CNPJ inválido";
                  hint = "O CPF informado não passou na validação. Volte ao formulário e confira se digitou corretamente.";
                } else if (isEmailError) {
                  title = "E-mail inválido";
                  hint = "O e-mail informado não é válido. Volte ao formulário e confira.";
                } else if (isPhoneError) {
                  title = "Telefone inválido";
                  hint = "O telefone informado não é válido. Volte ao formulário e confira.";
                } else {
                  title = "Não foi possível iniciar o pagamento";
                  hint = "Tente novamente em alguns instantes. Se o erro persistir, fale com o suporte.";
                }
                return (
                  <div className={`${isDataError ? "bg-ozx-danger/10 border-ozx-danger/30" : "bg-ozx-warning/10 border-ozx-warning/30"} border rounded-2xl p-5`} data-testid="payment-error-box">
                    <p className={`text-sm font-semibold mb-1 ${isDataError ? "text-ozx-danger" : "text-ozx-warning"}`}>
                      ⚠ {title}
                    </p>
                    <p className="text-sm text-white/80 leading-relaxed">{hint}</p>
                    {order.payment_error && (
                      <details className="mt-3">
                        <summary className="text-xs text-ozx-muted cursor-pointer hover:text-white transition">Ver detalhes técnicos</summary>
                        <p className="text-xs text-ozx-muted mt-1.5 font-mono">{order.payment_error}</p>
                      </details>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 mt-5">
                      {isDataError && (
                        <Button
                          onClick={() => navigate("/checkout")}
                          className="bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full"
                          data-testid="payment-back-to-checkout"
                        >
                          ← Voltar para o formulário
                        </Button>
                      )}
                      <Button onClick={retry} variant="outline" className="border-white/15 text-white" data-testid="payment-try-pagbank">
                        Tentar novamente com PagBank
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function AsaasRedirect({ order, onRefresh }) {
  const isPix = (order.payment_method || "").toLowerCase() === "pix";
  const methodLabel = isPix ? "PIX" : "cartão de crédito parcelado em até 10x sem juros";
  const REDIRECT_MS = 4200;

  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = order.asaas_checkout_url;
    }, REDIRECT_MS);
    return () => clearTimeout(t);
  }, [order.asaas_checkout_url]);

  return (
    <div className="space-y-6" data-testid="payment-asaas-checkout">
      <div className="glass-card rounded-2xl p-5 bg-ozx-primary/5 border-ozx-primary/20">
        <p className="text-sm text-ozx-muted leading-relaxed">
          Seu pagamento será concluído em um <span className="text-white font-medium">ambiente seguro de pagamento</span>, com <span className="text-white">{methodLabel}</span>.
        </p>
      </div>

      {/* Loader criativo: anéis pulsantes + órbita de pontos + ícone central */}
      <div className="relative flex flex-col items-center justify-center py-10" data-testid="payment-asaas-redirecting">
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* anéis pulsantes */}
          {[0, 0.6, 1.2].map((delay, i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-ozx-primary/60"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
            />
          ))}

          {/* órbita rotativa com 3 pontos */}
          <motion.div
            className="absolute inset-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          >
            {[0, 120, 240].map((deg) => (
              <span
                key={deg}
                className="absolute top-1/2 left-1/2 w-2.5 h-2.5 -mt-1.5 -ml-1.5 rounded-full bg-ozx-primary shadow-[0_0_12px_2px_rgba(56,178,255,0.6)]"
                style={{ transform: `rotate(${deg}deg) translate(0, -3.75rem)` }}
              />
            ))}
          </motion.div>

          {/* núcleo com ícone de escudo */}
          <motion.div
            className="relative w-20 h-20 rounded-full bg-gradient-to-br from-ozx-primary to-ozx-primary/40 flex items-center justify-center shadow-[0_0_40px_rgba(56,178,255,0.35)]"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ShieldCheck className="w-9 h-9 text-ozx-bg" strokeWidth={2.2} />
          </motion.div>
        </div>

        <div className="mt-8 text-center">
          <motion.p
            className="font-display text-2xl text-white"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            Redirecionando para o pagamento
          </motion.p>
          <p className="text-xs text-ozx-muted mt-2 tracking-wider uppercase">Preparando ambiente seguro</p>
        </div>

        {/* barra de progresso */}
        <div className="mt-6 w-64 h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-ozx-primary via-white to-ozx-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: REDIRECT_MS / 1000, ease: "easeInOut" }}
          />
        </div>
      </div>

      <p className="text-xs text-center text-ozx-muted">
        Se não abrir automaticamente,{" "}
        <a
          href={order.asaas_checkout_url}
          className="underline text-ozx-primary hover:text-ozx-primaryHover"
          data-testid="payment-asaas-fallback-link"
        >
          clique aqui
        </a>
        .
      </p>

      <Button variant="ghost" className="w-full text-ozx-muted" onClick={onRefresh} data-testid="payment-refresh-asaas">
        <RefreshCw className="w-4 h-4 mr-2" /> Já paguei, atualizar status
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Copy, RefreshCw, CheckCircle2, AlertCircle, Clock, QrCode } from "lucide-react";
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
    fetchOrder();
    if (!polling) return;
    const id = setInterval(fetchOrder, 6000);
    return () => clearInterval(id);
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

              {isCard && order.pagbank_payment_link ? (
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
              ) : (
                <div className="bg-ozx-warning/10 border border-ozx-warning/30 rounded-2xl p-5">
                  <p className="text-sm text-ozx-warning">⚠ Integração PagBank ainda não configurada pelo administrador, ou houve falha temporária.</p>
                  {order.payment_error && <p className="text-xs text-ozx-muted mt-2">{order.payment_error}</p>}
                  <Button onClick={retry} variant="outline" className="mt-4 border-white/15 text-white" data-testid="payment-try-pagbank">
                    Tentar novamente com PagBank
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

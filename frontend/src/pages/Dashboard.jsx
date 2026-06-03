import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { motion } from "framer-motion";
import { Download, Sparkles, QrCode, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creds, setCreds] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [c, o] = await Promise.all([
        api.get("/me/credentials"),
        api.get("/orders/mine"),
      ]);
      setCreds(c.data);
      setOrders(o.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-ozx-bg">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 lg:px-12 pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Painel</p>
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">Olá, {user?.name?.split(" ")[0]}.</h1>
          <p className="text-ozx-muted mt-2">Sua experiência Ozoxx começa aqui.</p>
        </motion.div>

        {/* Credenciais */}
        <section className="mb-16">
          <h2 className="font-display text-2xl mb-6 flex items-center gap-2"><Sparkles className="w-5 h-5 text-ozx-primary" /> Suas credenciais</h2>
          {loading ? (
            <div className="text-ozx-muted text-sm">Carregando...</div>
          ) : creds.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center">
              <QrCode className="w-12 h-12 text-ozx-muted mx-auto mb-3" />
              <p className="text-ozx-muted mb-4">Você ainda não tem credencial emitida.</p>
              <Button onClick={() => navigate("/checkout")} className="bg-ozx-primary text-ozx-bg rounded-full px-6 font-semibold">
                Garantir Ingresso <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {creds.map((c) => (
                <motion.div
                  key={c.credential_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-3xl glass-card border-ozx-primary/20 p-6"
                  data-testid={`credential-${c.credential_code}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-ozx-secondary/40 via-transparent to-ozx-primary/10" />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[10px] tracking-[0.3em] text-ozx-primary uppercase mb-1">Credencial</p>
                        <p className="font-display text-2xl">{c.name}</p>
                        <p className="text-xs text-ozx-muted mt-1">{c.ticket_type_name || "Ingresso"}</p>
                      </div>
                      {c.checked_in ? (
                        <span className="px-2 py-1 rounded-full bg-ozx-success/15 border border-ozx-success/30 text-[10px] text-ozx-success uppercase tracking-wider">Check-in feito</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-ozx-primary/15 border border-ozx-primary/30 text-[10px] text-ozx-primary uppercase tracking-wider">Ativa</span>
                      )}
                    </div>
                    <div className="bg-white rounded-2xl p-4 flex items-center justify-center mb-4">
                      <img src={c.qr_png} alt="QR" className="w-48 h-48" />
                    </div>
                    <p className="text-center text-xs text-ozx-muted tracking-wider">CÓDIGO: <span className="text-white">{c.credential_code}</span></p>
                    <div className="flex gap-2 mt-4">
                      <a href={c.qr_png} download={`credencial-${c.credential_code}.png`} className="flex-1">
                        <Button variant="outline" className="w-full border-white/15 text-white" data-testid={`credential-download-${c.credential_code}`}>
                          <Download className="w-4 h-4 mr-2" /> PNG
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        className="flex-1 border-ozx-primary/40 text-ozx-primary"
                        onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/me/credentials/${c.credential_code}/pdf`, "_blank")}
                        data-testid={`credential-pdf-${c.credential_code}`}
                      >
                        <Download className="w-4 h-4 mr-2" /> PDF
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Pedidos */}
        <section>
          <h2 className="font-display text-2xl mb-6">Meus pedidos</h2>
          {orders.length === 0 ? (
            <p className="text-ozx-muted text-sm">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.order_id} className="glass-card rounded-2xl p-5 flex items-center justify-between" data-testid={`order-${o.order_id}`}>
                  <div>
                    <p className="font-display text-lg">{o.ticket_type_name}</p>
                    <p className="text-xs text-ozx-muted">{o.quantity}x · R$ {Number(o.total_amount).toFixed(2).replace(".", ",")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full uppercase tracking-wider ${
                      o.status === "PAID" ? "bg-ozx-success/15 text-ozx-success" :
                      o.status === "WAITING" ? "bg-ozx-warning/15 text-ozx-warning" :
                      "bg-ozx-danger/15 text-ozx-danger"
                    }`}>{o.status}</span>
                    {o.status !== "PAID" && (
                      <Button size="sm" variant="outline" className="border-white/15" onClick={() => navigate(`/payment/${o.order_id}`)}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retomar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

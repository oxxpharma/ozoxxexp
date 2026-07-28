import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import { Award, Target, TrendingUp, Copy, Share2, Trophy, Sparkles, ArrowRight, Ticket, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import { statusLabel } from "../lib/labels";

export default function LeaderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/me/leader"); setData(data); }
    catch (e) { if (e.response?.status === 404) navigate("/dashboard"); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  if (!data) return <div className="min-h-screen flex items-center justify-center text-ozx-muted">Carregando...</div>;

  const link = `${window.location.origin}/l/${data.slug}`;
  const copy = () => { navigator.clipboard.writeText(link); toast.success("Link copiado!"); };
  const share = () => {
    if (navigator.share) navigator.share({ title: "Ozoxx Experience", text: "Garanta seu ingresso!", url: link });
    else copy();
  };

  const remaining = Math.max(0, data.target_sales - data.tickets_sold);
  const progressPct = data.progress_pct || 0;

  return (
    <div className="min-h-screen bg-ozx-bg">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 lg:px-12 pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-ozx-primary" />
            <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary">Programa de Líderes</p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">Olá, {user?.name?.split(" ")[0]}!</h1>
          <p className="text-ozx-muted mt-2">Você é um líder Ozoxx. Bata sua meta e ganhe seu ingresso oficial.</p>
        </motion.div>

        {/* Progress card */}
        <div className="glass-strong rounded-3xl p-6 lg:p-10 mb-6 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 h-64 w-64 bg-ozx-primary/20 blur-3xl rounded-full" />
          <div className="relative">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-ozx-muted mb-1">Sua meta</p>
                <p className="font-display text-5xl"><span className="text-ozx-primary">{data.tickets_sold}</span> / {data.target_sales}</p>
                <p className="text-ozx-muted text-sm mt-1">ingressos vendidos</p>
              </div>
              {data.goal_reached ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-ozx-success/15 border border-ozx-success/30 text-ozx-success">
                  <Trophy className="w-4 h-4" /> META ATINGIDA — INGRESSO LIBERADO!
                </div>
              ) : (
                <div className="text-right">
                  <p className="font-display text-3xl text-ozx-primary">{progressPct}%</p>
                  <p className="text-xs text-ozx-muted">{remaining} para a meta</p>
                </div>
              )}
            </div>
            <div className="h-4 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-ozx-primary to-ozx-primaryHover progress-glow rounded-full"
                data-testid="leader-progress-bar"
              />
            </div>
            {!data.goal_reached && remaining <= 3 && (
              <p className="text-ozx-warning text-sm mt-4 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Falta tão pouco! Só {remaining} venda{remaining !== 1 ? "s" : ""} para conquistar seu ingresso.</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Target} label="Meta" value={data.target_sales} />
          <StatCard icon={TrendingUp} label="Vendidos" value={data.tickets_sold} color="text-ozx-success" />
          <StatCard icon={Sparkles} label="Pendentes" value={data.pending_orders} color="text-ozx-warning" />
          <StatCard icon={Trophy} label="Receita gerada" value={`R$ ${Number(data.revenue).toFixed(0)}`} color="text-ozx-primary" />
        </div>

        {/* Link */}
        <div className="glass-card rounded-3xl p-6 lg:p-8 mb-6">
          <p className="text-xs uppercase tracking-wider text-ozx-muted mb-2">Seu link exclusivo</p>
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="flex-1 px-4 py-3 rounded-2xl bg-ozx-bg2 border border-white/10 font-mono text-sm break-all">{link}</div>
            <Button onClick={copy} className="bg-ozx-primary text-ozx-bg font-semibold rounded-full" data-testid="leader-copy-btn"><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
            <Button onClick={share} variant="outline" className="border-white/15 text-white rounded-full"><Share2 className="w-4 h-4 mr-2" /> Compartilhar</Button>
          </div>
          <p className="text-xs text-ozx-muted mt-3">Divulgue nas redes, grupos e contatos. Toda compra através deste link conta para a sua meta.</p>
        </div>

        {/* Courtesy credential unlocked */}
        {data.goal_reached && data.courtesy?.credential && (
          <div className="glass-strong rounded-3xl p-6 lg:p-8 mb-6 relative overflow-hidden border border-ozx-success/30" data-testid="leader-courtesy-card">
            <div className="absolute -right-24 -top-24 h-72 w-72 bg-ozx-success/20 blur-3xl rounded-full" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-ozx-success" />
                <p className="text-xs uppercase tracking-[0.25em] text-ozx-success">Ingresso conquistado</p>
              </div>
              <h3 className="font-display text-2xl mb-2">Sua credencial oficial está pronta</h3>
              <p className="text-ozx-muted mb-4">Bateu a meta! O ingresso {data.courtesy.order?.ticket_type_name} foi gerado no seu nome — código <span className="font-mono text-white">{data.courtesy.credential.credential_code}</span>.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => navigate(`/dashboard?highlight=${data.courtesy.credential.credential_code}`)}
                  className="bg-ozx-success text-ozx-bg font-semibold rounded-full"
                  data-testid="leader-view-credential"
                >
                  <Ticket className="w-4 h-4 mr-2" /> Ver minha credencial
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Buyers list */}
        <div className="glass-card rounded-3xl p-6 lg:p-8 mb-6" data-testid="leader-buyers-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-ozx-primary" />
              <h3 className="font-display text-xl">Quem comprou pelo seu link</h3>
            </div>
            <p className="text-xs text-ozx-muted">{data.buyers?.length || 0} pedido{(data.buyers?.length || 0) !== 1 ? "s" : ""}</p>
          </div>
          {!data.buyers || data.buyers.length === 0 ? (
            <div className="text-center py-8 text-ozx-muted text-sm">
              Ainda ninguém comprou pelo seu link. Compartilhe acima e comece a vender!
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead className="text-ozx-muted text-[10px] uppercase tracking-wider">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-2 py-2">Pedido</th>
                    <th className="text-left px-2 py-2">Cliente</th>
                    <th className="text-left px-2 py-2">Ingressos</th>
                    <th className="text-left px-2 py-2">Status</th>
                    <th className="text-right px-2 py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.buyers.map((o) => (
                    <tr key={o.order_id} className="border-b border-white/5" data-testid={`leader-buyer-${o.order_id}`}>
                      <td className="px-2 py-3 font-mono text-xs text-ozx-muted">{o.order_id.slice(-8)}</td>
                      <td className="px-2 py-3">
                        <p>{o.holder_name}</p>
                        <p className="text-[10px] text-ozx-muted">{o.holder_email}</p>
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-display text-lg leading-none">{o.quantity}x</p>
                        <p className="text-[10px] text-ozx-muted">{o.ticket_type_name}{o.lot_name && ` · ${o.lot_name}`}</p>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          o.status === "PAID" ? "bg-ozx-success/15 text-ozx-success border border-ozx-success/30" :
                          o.status === "COURTESY" ? "bg-ozx-primary/15 text-ozx-primary border border-ozx-primary/30" :
                          o.status === "WAITING" ? "bg-ozx-warning/15 text-ozx-warning border border-ozx-warning/30" :
                          "bg-white/5 text-ozx-muted border border-white/10"
                        }`}>{statusLabel(o.status)}</span>
                      </td>
                      <td className="px-2 py-3 text-right text-xs text-ozx-muted whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        <br />
                        <span className="text-[10px]">{new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-ozx-muted mt-3">Só pedidos pagos/cortesia contam para a sua meta. Pedidos &quot;aguardando pagamento&quot; só serão computados após a confirmação.</p>
        </div>

        {/* Motivation */}
        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <h3 className="font-display text-xl mb-4">💡 Dicas para acelerar suas vendas</h3>
          <ul className="space-y-2 text-sm text-ozx-muted">
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Compartilhe seu link no status do WhatsApp e Stories do Instagram regularmente.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Conte sua experiência — pessoas compram por conexão, não por anúncio.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Crie urgência: lembre dos lotes promocionais que estão acabando.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Convide quem você acha que vai amar o evento — qualidade &gt; quantidade.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <Icon className={`w-5 h-5 ${color || "text-ozx-primary"} mb-2`} />
      <p className="text-xs uppercase text-ozx-muted tracking-wider">{label}</p>
      <p className="font-display text-3xl mt-1">{value}</p>
    </div>
  );
}

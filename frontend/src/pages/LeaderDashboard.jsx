import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import { Award, Target, TrendingUp, Copy, Share2, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { toast } from "sonner";

export default function LeaderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = async () => {
    try { const { data } = await api.get("/api/me/leader"); setData(data); }
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

        {/* Motivation */}
        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <h3 className="font-display text-xl mb-4">💡 Dicas para acelerar suas vendas</h3>
          <ul className="space-y-2 text-sm text-ozx-muted">
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Compartilhe seu link no status do WhatsApp e Stories do Instagram regularmente.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Conte sua experiência — pessoas compram por conexão, não por anúncio.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Crie urgência: lembre dos lotes promocionais que estão acabando.</li>
            <li className="flex gap-2"><ArrowRight className="w-4 h-4 text-ozx-primary flex-shrink-0 mt-0.5" /> Convide quem você acha que vai amar o evento — qualidade > quantidade.</li>
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

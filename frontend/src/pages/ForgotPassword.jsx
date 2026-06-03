import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [sent, setSent] = useState(false);
  const submit = async (e) => { e.preventDefault(); setLoading(true);
    try { await api.post("/auth/forgot-password", { email }); setSent(true); toast.success("Se este e-mail estiver cadastrado, enviaremos instruções."); }
    catch { toast.error("Erro"); } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <Link to="/login" className="absolute top-6 left-6 text-ozx-muted hover:text-white flex items-center gap-2 text-sm"><ArrowLeft className="w-4 h-4" /> Voltar ao login</Link>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-card rounded-3xl p-8 lg:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Recuperação</p>
        <h1 className="font-display text-4xl font-medium tracking-tight">Esqueci minha senha</h1>
        <p className="text-ozx-muted text-sm mt-2 mb-8">Enviaremos um link de redefinição para seu e-mail.</p>
        {sent ? (
          <div className="p-4 rounded-2xl bg-ozx-success/10 border border-ozx-success/30 text-ozx-success">
            ✓ Verifique sua caixa de entrada e siga o link enviado.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div><Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">E-mail</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ozx-muted" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white h-12" data-testid="forgot-email" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6" data-testid="forgot-submit">
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

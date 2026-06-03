import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (e) => { e.preventDefault();
    if (password !== confirm) return toast.error("Senhas não conferem");
    if (password.length < 6) return toast.error("Mínimo 6 caracteres");
    setLoading(true);
    try { await api.post("/auth/reset-password", { token, password }); toast.success("Senha redefinida!"); navigate("/login"); }
    catch (e) { toast.error(e.response?.data?.detail || "Erro"); } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <Link to="/login" className="absolute top-6 left-6 text-ozx-muted hover:text-white flex items-center gap-2 text-sm"><ArrowLeft className="w-4 h-4" /> Login</Link>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-card rounded-3xl p-8 lg:p-10">
        <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Nova senha</p>
        <h1 className="font-display text-4xl font-medium tracking-tight mb-8">Redefinir senha</h1>
        <form onSubmit={submit} className="space-y-4">
          <div><Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Nova senha</Label>
            <div className="relative"><Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ozx-muted" />
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white h-12" data-testid="reset-password" /></div>
          </div>
          <div><Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Confirme</Label>
            <div className="relative"><Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ozx-muted" />
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white h-12" data-testid="reset-confirm" /></div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6" data-testid="reset-submit">
            {loading ? "Salvando..." : "Redefinir senha"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

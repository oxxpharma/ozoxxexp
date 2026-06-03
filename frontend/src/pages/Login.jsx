import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock } from "lucide-react";

function formatErr(d) {
  if (!d) return "Erro ao processar";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return d?.msg || JSON.stringify(d);
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Bem-vindo, ${u.name}!`);
      if (u.role === "admin") nav("/admin");
      else if (u.role === "credenciadora") nav("/scanner");
      else nav("/dashboard");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Erro ao entrar");
    } finally { setLoading(false); }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirect = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <Link to="/" className="absolute top-6 left-6 text-ozx-muted hover:text-white flex items-center gap-2 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md glass-card rounded-3xl p-8 lg:p-10"
      >
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Login</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Bem-vindo de volta</h1>
          <p className="text-ozx-muted text-sm mt-2">Acesse sua credencial e gerencie seus pedidos.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">E-mail</Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ozx-muted" />
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white h-12" placeholder="seu@email.com" data-testid="login-email" />
            </div>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-2 block">Senha</Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ozx-muted" />
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-white/5 border-white/10 text-white h-12" data-testid="login-password" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6" data-testid="login-submit">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-ozx-muted">ou</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <Button onClick={googleLogin} variant="outline" className="w-full border-white/15 text-white hover:bg-white/10 rounded-full py-6" data-testid="login-google">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".8"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".6"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" opacity=".4"/></svg>
          Continuar com Google
        </Button>

        <p className="text-center text-sm text-ozx-muted mt-6">
          Não tem conta? <Link to="/register" className="text-ozx-primary hover:underline">Criar conta</Link>
        </p>
        <p className="text-center text-xs text-ozx-muted mt-2">
          <Link to="/forgot-password" className="hover:text-white">Esqueci minha senha</Link>
        </p>
      </motion.div>
    </div>
  );
}

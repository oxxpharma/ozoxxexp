import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

function formatErr(d) {
  if (!d) return "Erro ao processar";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return d?.msg || JSON.stringify(d);
}

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", cpf: "" });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Conta criada com sucesso!");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || "Erro");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <Link to="/" className="absolute top-6 left-6 text-ozx-muted hover:text-white flex items-center gap-2 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md glass-card rounded-3xl p-8 lg:p-10"
      >
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Cadastro</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Criar conta</h1>
          <p className="text-ozx-muted text-sm mt-2">Acompanhe seu pedido e receba sua credencial.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-1.5 block">Nome completo</Label>
            <Input required value={form.name} onChange={set("name")} className="bg-white/5 border-white/10 text-white h-11" data-testid="register-name" />
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-1.5 block">E-mail</Label>
            <Input required type="email" value={form.email} onChange={set("email")} className="bg-white/5 border-white/10 text-white h-11" data-testid="register-email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-1.5 block">Telefone</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-9999" className="bg-white/5 border-white/10 text-white h-11" data-testid="register-phone" />
            </div>
            <div>
              <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-1.5 block">CPF</Label>
              <Input value={form.cpf} onChange={set("cpf")} className="bg-white/5 border-white/10 text-white h-11" data-testid="register-cpf" />
            </div>
          </div>
          <div>
            <Label className="text-ozx-muted text-xs uppercase tracking-wider mb-1.5 block">Senha</Label>
            <Input required type="password" value={form.password} onChange={set("password")} className="bg-white/5 border-white/10 text-white h-11" data-testid="register-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6 mt-2" data-testid="register-submit">
            {loading ? "Criando..." : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-ozx-muted mt-6">
          Já tem conta? <Link to="/login" className="text-ozx-primary hover:underline">Entrar</Link>
        </p>
      </motion.div>
    </div>
  );
}

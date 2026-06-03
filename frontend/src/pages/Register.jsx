import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

function fmt(d) { if (!d) return "Erro"; if (typeof d === "string") return d; if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(" "); return d?.msg || JSON.stringify(d); }

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", cpf: "", birth_date: "", gender: "", city: "", state: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await register(form); toast.success("Conta criada!"); nav("/dashboard"); }
    catch (err) { toast.error(fmt(err.response?.data?.detail) || "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      <Link to="/" className="absolute top-6 left-6 text-ozx-muted hover:text-white flex items-center gap-2 text-sm"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg glass-card rounded-3xl p-8 lg:p-10">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Cadastro</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Criar conta</h1>
        </div>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label className="text-ozx-muted text-xs uppercase">Nome completo</Label>
          <Input required value={form.name} onChange={set("name")} className="bg-white/5 border-white/10 text-white h-11 mt-1" data-testid="register-name" /></div>
          <div className="col-span-2"><Label className="text-ozx-muted text-xs uppercase">E-mail</Label>
          <Input required type="email" value={form.email} onChange={set("email")} className="bg-white/5 border-white/10 text-white h-11 mt-1" data-testid="register-email" /></div>
          <div className="col-span-2"><Label className="text-ozx-muted text-xs uppercase">Senha</Label>
          <Input required type="password" value={form.password} onChange={set("password")} className="bg-white/5 border-white/10 text-white h-11 mt-1" data-testid="register-password" /></div>
          <div><Label className="text-ozx-muted text-xs uppercase">Telefone</Label>
          <Input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-9999" className="bg-white/5 border-white/10 text-white h-11 mt-1" /></div>
          <div><Label className="text-ozx-muted text-xs uppercase">CPF</Label>
          <Input value={form.cpf} onChange={set("cpf")} className="bg-white/5 border-white/10 text-white h-11 mt-1" /></div>
          <div><Label className="text-ozx-muted text-xs uppercase">Nascimento</Label>
          <Input type="date" value={form.birth_date} onChange={set("birth_date")} className="bg-white/5 border-white/10 text-white h-11 mt-1" /></div>
          <div><Label className="text-ozx-muted text-xs uppercase">Sexo</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent className="bg-ozx-bg2 text-white border-white/10">
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
                <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-ozx-muted text-xs uppercase">Cidade</Label>
          <Input value={form.city} onChange={set("city")} className="bg-white/5 border-white/10 text-white h-11 mt-1" /></div>
          <div><Label className="text-ozx-muted text-xs uppercase">UF</Label>
          <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} className="bg-white/5 border-white/10 text-white h-11 mt-1" /></div>
          <Button type="submit" disabled={loading} className="col-span-2 w-full bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full py-6 mt-2" data-testid="register-submit">
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

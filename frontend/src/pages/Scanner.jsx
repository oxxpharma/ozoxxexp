import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CheckCircle2, AlertCircle, ScanLine, Camera, CameraOff, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";

export default function Scanner() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState("");
  const [recent, setRecent] = useState([]);
  const scannerRef = useRef(null);
  const html5Ref = useRef(null);

  const loadRecent = async () => {
    try {
      const { data } = await api.get("/scanner/checkins");
      setRecent(data);
    } catch {}
  };

  useEffect(() => { loadRecent(); }, []);

  const validate = async (code) => {
    try {
      const { data } = await api.post("/scanner/validate", { code });
      setResult(data);
      loadRecent();
      // auto-clear after 4s
      setTimeout(() => setResult(null), 5000);
    } catch (e) {
      setResult({ valid: false, message: e.response?.data?.detail || "Erro ao validar" });
      setTimeout(() => setResult(null), 4000);
    }
  };

  const startScan = async () => {
    setResult(null);
    setScanning(true);
    setTimeout(async () => {
      try {
        if (!html5Ref.current) {
          html5Ref.current = new Html5Qrcode("qr-reader");
        }
        await html5Ref.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decoded) => {
            await html5Ref.current.stop();
            setScanning(false);
            await validate(decoded);
          },
          () => {}
        );
      } catch (e) {
        setScanning(false);
        setResult({ valid: false, message: "Não foi possível acessar a câmera" });
      }
    }, 100);
  };

  const stopScan = async () => {
    if (html5Ref.current) {
      try { await html5Ref.current.stop(); } catch {}
    }
    setScanning(false);
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    await validate(manual.trim().toUpperCase());
    setManual("");
  };

  return (
    <div className="min-h-screen bg-ozx-bg">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <button onClick={() => navigate("/")} className="text-ozx-muted hover:text-white text-sm flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-2">Credenciadora</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">Scanner de credenciais</h1>
        </div>

        <div className="glass-card rounded-3xl p-6 mb-6">
          <div id="qr-reader" ref={scannerRef} className={`${scanning ? "block" : "hidden"} rounded-2xl overflow-hidden mb-4`} />
          {!scanning ? (
            <Button onClick={startScan} className="w-full bg-ozx-primary text-ozx-bg rounded-full py-6 font-semibold" data-testid="scanner-start">
              <Camera className="w-4 h-4 mr-2" /> Iniciar câmera
            </Button>
          ) : (
            <Button onClick={stopScan} variant="outline" className="w-full border-white/15 text-white rounded-full py-6" data-testid="scanner-stop">
              <CameraOff className="w-4 h-4 mr-2" /> Parar
            </Button>
          )}

          <div className="my-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-ozx-muted">OU INSIRA O CÓDIGO</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={submitManual} className="flex gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="OZX-XXXX..." className="bg-white/5 border-white/10 text-white uppercase" data-testid="scanner-manual-input" />
            <Button type="submit" className="bg-ozx-primary text-ozx-bg" data-testid="scanner-manual-submit">
              <ScanLine className="w-4 h-4" />
            </Button>
          </form>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-3xl p-6 mb-6 border-2 ${result.valid ? "bg-ozx-success/10 border-ozx-success/40" : "bg-ozx-danger/10 border-ozx-danger/40"}`}
              data-testid="scanner-result"
            >
              <div className="flex items-start gap-4">
                {result.valid ? (
                  <CheckCircle2 className="w-10 h-10 text-ozx-success" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-ozx-danger" />
                )}
                <div className="flex-1">
                  <p className={`font-display text-2xl ${result.valid ? "text-ozx-success" : "text-ozx-danger"}`}>
                    {result.valid ? "Acesso liberado" : "Não autorizado"}
                  </p>
                  <p className="text-ozx-muted text-sm">{result.message}</p>
                  {result.credential && (
                    <div className="mt-3 text-sm">
                      <p>Nome: <span className="text-white">{result.credential.name}</span></p>
                      <p>Tipo: <span className="text-white">{result.credential.ticket_type_name}</span></p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-display text-lg mb-4">Check-ins recentes</h3>
          {recent.length === 0 ? (
            <p className="text-ozx-muted text-sm">Nenhum check-in ainda.</p>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 10).map((c) => (
                <div key={c.credential_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{c.name}</p>
                    <p className="text-xs text-ozx-muted">{c.credential_code}</p>
                  </div>
                  <p className="text-xs text-ozx-muted">{new Date(c.checked_in_at).toLocaleTimeString("pt-BR")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

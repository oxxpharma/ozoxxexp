import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/login"); return; }
    const sessionId = m[1];

    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", null, {
          headers: { "X-Session-ID": sessionId },
        });
        setUser(data.user);
        if (data.user.role === "admin") navigate("/admin");
        else if (data.user.role === "credenciadora") navigate("/scanner");
        else navigate("/dashboard");
      } catch {
        navigate("/login");
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-ozx-muted text-sm tracking-widest uppercase">Conectando...</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function diff(target) {
  const now = new Date();
  const t = new Date(target);
  const ms = t - now;
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds, done: false };
}

export default function Countdown({ target }) {
  const [time, setTime] = useState(() => diff(target));

  useEffect(() => {
    const id = setInterval(() => setTime(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const cells = [
    { label: "DIAS", value: time.days },
    { label: "HORAS", value: time.hours },
    { label: "MIN", value: time.minutes },
    { label: "SEG", value: time.seconds },
  ];

  return (
    <div className="flex gap-3 sm:gap-4" data-testid="countdown-timer">
      {cells.map((c, idx) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl px-4 py-4 sm:px-6 sm:py-5 min-w-[78px] sm:min-w-[110px] text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-ozx-primary/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="font-display text-3xl sm:text-5xl font-semibold tabular-nums">
              {String(c.value).padStart(2, "0")}
            </div>
            <div className="text-[10px] sm:text-xs text-ozx-muted tracking-[0.25em] mt-1">{c.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../lib/api";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { MapPin, Calendar, Sparkles, Users, Zap, Shield, ArrowRight, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Countdown from "../components/Countdown";
import AddToCalendar from "../components/AddToCalendar";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

export default function Landing() {
  const [config, setConfig] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/public/config").then((r) => setConfig(r.data)).catch(() => {});
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ozx-muted text-sm tracking-widest uppercase">
        Carregando experiência...
      </div>
    );
  }

  const { event, appearance, tickets, lots = [], current_lots = {} } = config;
  const ticketWithLot = (t) => current_lots[t.ticket_type_id] || lots.find((l) => l.ticket_type_id === t.ticket_type_id && l.is_active);

  return (
    <div className="min-h-screen bg-ozx-bg text-white relative overflow-x-hidden">
      <Navbar logoUrl={appearance.logo_url} logoSize={appearance.logo_size} />

      {/* HERO */}
      <section className="relative min-h-screen flex items-end pb-24 pt-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={appearance.hero_image_url} alt="" className="w-full h-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-b from-ozx-bg/60 via-ozx-bg/40 to-ozx-bg" />
          <div className="absolute inset-0 bg-gradient-to-r from-ozx-bg via-transparent to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-end">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl"
          >
            <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-1.5 mb-8" data-testid="hero-badge">
              <span className="h-1.5 w-1.5 rounded-full bg-ozx-primary animate-pulse" />
              <span className="text-xs tracking-[0.25em] uppercase text-ozx-muted">{event.short_pitch}</span>
            </div>

            <h1 className="font-display text-5xl sm:text-7xl lg:text-[110px] font-semibold tracking-[-0.03em] leading-[0.95] mb-6" data-testid="hero-headline">
              {event.hero_headline}<span className="text-ozx-primary">.</span>
            </h1>

            <p className="text-lg sm:text-xl text-ozx-muted max-w-2xl mb-10 leading-relaxed" data-testid="hero-subheadline">
              {event.hero_subheadline}
            </p>

            <div className="mb-12">
              <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-4">A experiência começa em</p>
              <Countdown target={event.start_date} />
            </div>

            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => navigate("/checkout")}
                className="bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full px-8 py-6 text-base glow-primary"
                data-testid="hero-cta-primary"
              >
                {event.cta_primary} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <AddToCalendar event={event} />
            </div>
          </motion.div>

          {appearance.hero_side_image_url && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative hidden lg:block"
            >
              <div className="absolute -inset-6 bg-ozx-primary/20 blur-3xl rounded-full" />
              <img
                src={appearance.hero_side_image_url}
                alt=""
                className="relative w-[320px] xl:w-[420px] h-auto rounded-3xl border border-white/10 shadow-2xl glow-primary"
                data-testid="hero-side-image"
              />
            </motion.div>
          )}

          {appearance.hero_side_image_url && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.4 }}
              className="lg:hidden -mt-4 mb-4"
            >
              <img
                src={appearance.hero_side_image_url}
                alt=""
                className="w-48 sm:w-64 h-auto rounded-2xl border border-white/10 shadow-2xl glow-primary"
                data-testid="hero-side-image-mobile"
              />
            </motion.div>
          )}
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-white/5 py-6 bg-ozx-bg2/40 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {Array(2).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-4 font-display text-2xl sm:text-3xl">
              {["OZOXX EXPERIENCE", "SÃO PAULO 2025", "08•09 OUTUBRO", "ONDE EMOÇÃO ACONTECE", "EDIÇÃO INAUGURAL", "OZOXX EXPERIENCE", "SÃO PAULO 2025", "08•09 OUTUBRO"].map((t, j) => (
                <span key={j} className="flex items-center gap-8">
                  <span className="text-white/80">{t}</span>
                  <span className="text-ozx-primary">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* SOBRE / BENTO */}
      <section id="sobre" className="py-24 lg:py-32 max-w-7xl mx-auto px-6 lg:px-12">
        <motion.div {...fadeUp} className="max-w-3xl mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-4">Sobre o evento</p>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            Dois dias. Uma experiência inesquecível.
          </h2>
          <p className="text-ozx-muted text-lg leading-relaxed">{event.description}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6">
          <motion.div {...fadeUp} className="md:col-span-7 glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden">
            <Sparkles className="w-8 h-8 text-ozx-primary mb-6" />
            <h3 className="font-display text-3xl font-medium mb-3">Programação imersiva</h3>
            <p className="text-ozx-muted leading-relaxed">Shows, palestras, painéis exclusivos, lounges premium e ativações de marca cuidadosamente curadas. Cada minuto pensado para você.</p>
            <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-ozx-primary/10 blur-3xl" />
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.8, delay: 0.1 }} className="md:col-span-5 glass-card rounded-3xl p-8 lg:p-10">
            <Calendar className="w-8 h-8 text-ozx-primary mb-6" />
            <h3 className="font-display text-2xl font-medium mb-3">Data</h3>
            <p className="text-2xl font-display text-white">08 e 09 Outubro</p>
            <p className="text-ozx-muted text-sm mt-1">2025 · 09h às 22h</p>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.8, delay: 0.15 }} className="md:col-span-5 glass-card rounded-3xl p-8 lg:p-10">
            <MapPin className="w-8 h-8 text-ozx-primary mb-6" />
            <h3 className="font-display text-2xl font-medium mb-3">Local</h3>
            <p className="text-xl font-display text-white">{event.location_name}</p>
            <p className="text-ozx-muted text-sm mt-1">{event.location_address}</p>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.8, delay: 0.2 }} className="md:col-span-7 glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden">
            <Users className="w-8 h-8 text-ozx-primary mb-6" />
            <h3 className="font-display text-3xl font-medium mb-3">Networking de alto nível</h3>
            <p className="text-ozx-muted leading-relaxed">Conecte-se com fundadores, criadores e líderes de marca em ambientes pensados para conversas que importam.</p>
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-ozx-secondary/30 blur-3xl" />
          </motion.div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="galeria" className="py-24 lg:py-32 max-w-7xl mx-auto px-6 lg:px-12">
        <motion.div {...fadeUp} className="mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Galeria</p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">O que esperar</h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          {appearance.gallery_images.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`overflow-hidden rounded-2xl glass-card ${i === 0 ? "md:col-span-2 md:row-span-2 md:aspect-square" : "aspect-[4/5]"}`}
            >
              <img src={src} alt={`gallery-${i}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* TICKETS */}
      <section id="ingressos" className="py-24 lg:py-32 max-w-7xl mx-auto px-6 lg:px-12">
        <motion.div {...fadeUp} className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Ingressos</p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">Escolha sua experiência</h2>
          <p className="text-ozx-muted mt-4">Inclua acompanhante no checkout e receba duas credenciais individualizadas.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {tickets.map((t, i) => {
            const lot = ticketWithLot(t);
            // collect all lots for this ticket, sorted by order
            const ticketLots = lots.filter((l) => l.ticket_type_id === t.ticket_type_id).sort((a, b) => (a.order || 0) - (b.order || 0));
            const visibleLot = lot || ticketLots[0];
            const isSoldOut = visibleLot ? !visibleLot.is_available : true;
            return (
            <motion.div
              key={t.ticket_type_id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative glass-card rounded-3xl p-8 lg:p-10 group transition-all ${isSoldOut ? "opacity-60" : "hover:border-ozx-primary/40"}`}
              data-testid={`ticket-card-${t.ticket_type_id}`}
            >
              {visibleLot && (
                <div className={`absolute top-6 right-6 px-3 py-1 rounded-full text-xs tracking-wider uppercase ${isSoldOut ? "bg-white/10 border border-white/20 text-ozx-muted" : "bg-ozx-primary/15 border border-ozx-primary/30 text-ozx-primary"}`}>
                  {visibleLot.name}
                </div>
              )}
              <Music className={`w-8 h-8 mb-6 ${isSoldOut ? "text-ozx-muted" : "text-ozx-primary"}`} />
              <h3 className="font-display text-3xl font-medium mb-2">{t.name}</h3>
              <p className="text-ozx-muted text-sm leading-relaxed mb-6">{t.description}</p>
              {visibleLot ? (
                <div className="mb-4">
                  {isSoldOut ? (
                    <div className="mb-2">
                      <span className="font-display text-4xl font-semibold text-ozx-muted line-through">R$ {Number(visibleLot.price).toFixed(2).replace(".", ",")}</span>
                      <p className="font-display text-3xl text-ozx-danger mt-1">ESGOTADO</p>
                    </div>
                  ) : (
                    <>
                      <span className="text-ozx-muted text-sm">a partir de</span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-5xl font-semibold">R$ {Number(visibleLot.price).toFixed(2).replace(".", ",")}</span>
                      </div>
                    </>
                  )}
                  {!isSoldOut && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-ozx-warning flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-ozx-warning animate-pulse" />
                          {visibleLot.progress_pct}% vendidos
                        </span>
                        <span className="text-ozx-muted">{visibleLot.remaining}/{visibleLot.quantity}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-ozx-warning to-ozx-danger" style={{ width: `${Math.min(100, visibleLot.progress_pct)}%` }} />
                      </div>
                    </div>
                  )}
                  {visibleLot.valid_until && !isSoldOut && (
                    <p className="text-xs text-ozx-muted mt-2">Válido até {new Date(visibleLot.valid_until).toLocaleDateString("pt-BR")}</p>
                  )}
                </div>
              ) : (
                <p className="text-ozx-muted text-sm mb-6">Em breve</p>
              )}
              <ul className="space-y-2 mb-8">
                {["Acesso aos 2 dias do evento", "Áreas premium e lounges", "Networking exclusivo", "Credencial digital com QR Code"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-ozx-muted">
                    <Zap className={`w-3.5 h-3.5 ${isSoldOut ? "text-ozx-muted" : "text-ozx-primary"}`} /> {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate(`/checkout?ticket=${t.ticket_type_id}`)}
                disabled={isSoldOut}
                className={`w-full font-semibold rounded-full py-6 ${isSoldOut ? "bg-white/10 text-ozx-muted cursor-not-allowed" : "bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg"}`}
                data-testid={`ticket-buy-${t.ticket_type_id}`}
              >
                {isSoldOut ? "Esgotado" : <>Comprar Agora <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </motion.div>
            );
          })}
        </div>

        <motion.div {...fadeUp} className="mt-12 flex justify-center">
          <div className="glass-card rounded-2xl px-6 py-4 flex items-center gap-3 max-w-md text-center">
            <Shield className="w-5 h-5 text-ozx-primary flex-shrink-0" />
            <p className="text-sm text-ozx-muted">Pagamentos 100% seguros via <span className="text-white">PagBank</span>. Dados criptografados.</p>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 lg:py-32 max-w-3xl mx-auto px-6 lg:px-12">
        <motion.div {...fadeUp} className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-ozx-primary mb-3">Perguntas</p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight">Tirando suas dúvidas</h2>
        </motion.div>
        <Accordion type="single" collapsible className="space-y-3">
          {(appearance.faq || []).map((f, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="glass-card rounded-2xl px-6 border-0"
              data-testid={`faq-${idx}`}
            >
              <AccordionTrigger className="text-left font-display text-lg hover:no-underline py-5">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-ozx-muted pb-5 leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12">
        <motion.div {...fadeUp} className="relative overflow-hidden glass-card rounded-3xl p-12 lg:p-20 text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-ozx-secondary/40 via-transparent to-ozx-primary/10" />
          <div className="relative">
            <h2 className="font-display text-4xl sm:text-6xl font-medium tracking-tight mb-6 max-w-3xl mx-auto">
              Não fique de fora. <span className="text-ozx-primary">São Paulo te espera.</span>
            </h2>
            <Button
              onClick={() => navigate("/checkout")}
              className="bg-ozx-primary hover:bg-ozx-primaryHover text-ozx-bg font-semibold rounded-full px-10 py-6 text-base glow-primary"
              data-testid="footer-cta"
            >
              Garantir minha vaga <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </section>

      <Footer event={event} />
    </div>
  );
}

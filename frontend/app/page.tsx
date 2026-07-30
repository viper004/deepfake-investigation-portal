"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const stats = [
  { value: "99.2%", label: "Detection Accuracy" },
  { value: "< 3s",  label: "Avg Analysis Time" },
  { value: "50M+",  label: "Media Files Scanned" },
  { value: "180+",  label: "Countries Served" },
];

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        <path d="M11 8v6M8 11h6"/>
      </svg>
    ),
    title: "AI-Powered Detection",
    desc: "State-of-the-art neural networks analyze facial inconsistencies, artifacts, and temporal anomalies across video and image media.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "Forensic Analysis",
    desc: "Deep forensic examination with metadata extraction, hash verification, and provenance tracking for chain-of-custody integrity.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    title: "Case Management",
    desc: "Organize investigations with structured case files, evidence tagging, timeline views, and collaborative team workflows.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Real-time Monitoring",
    desc: "Automated surveillance pipelines that continuously monitor social networks and news feeds for emerging deepfake content.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: "Automated Reports",
    desc: "Generate court-ready forensic reports with confidence scores, visual heatmaps, and technical methodology documentation.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
    title: "Secure Evidence Vault",
    desc: "End-to-end encrypted evidence storage with tamper-proof audit logs and role-based access controls for sensitive investigations.",
  },
];

const steps = [
  { num: "01", title: "Upload Media", desc: "Submit images, videos, or audio files via our secure upload interface or REST API." },
  { num: "02", title: "AI Analysis", desc: "Our multi-model ensemble detects facial manipulation, voice cloning, and temporal artifacts." },
  { num: "03", title: "Review Results", desc: "Inspect per-frame confidence scores, heatmaps, and detailed forensic breakdowns." },
  { num: "04", title: "Export Evidence", desc: "Generate signed PDF reports and export evidence packages for legal proceedings." },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#0a0a0a]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ─── Navbar ─── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/90 backdrop-blur-md border-b border-[#e5e5e5] shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#CC2200] rounded flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-bold text-base tracking-tight">DeepGuard</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {["Features", "How it works", "Pricing", "Docs"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="nav-link text-sm font-medium text-[#0a0a0a]/70 hover:text-[#0a0a0a] transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium px-4 py-2 rounded hover:bg-black/5 transition-colors">
              Sign in
            </Link>
            <Link
              href="/login"
              className="btn-primary text-sm font-semibold px-5 py-2.5 rounded bg-[#CC2200] text-white hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded hover:bg-black/5 transition-colors"
          >
            <div className="w-5 h-0.5 bg-[#0a0a0a] mb-1.5 transition-all" style={{ transform: mobileMenuOpen ? "rotate(45deg) translateY(8px)" : "none" }} />
            <div className="w-5 h-0.5 bg-[#0a0a0a] mb-1.5 transition-all" style={{ opacity: mobileMenuOpen ? 0 : 1 }} />
            <div className="w-5 h-0.5 bg-[#0a0a0a] transition-all" style={{ transform: mobileMenuOpen ? "rotate(-45deg) translateY(-8px)" : "none" }} />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#e5e5e5] px-6 pb-4 flex flex-col gap-3">
            {["Features", "How it works", "Pricing", "Docs"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`} className="text-sm font-medium py-2 border-b border-[#f0f0f0] last:border-0">
                {item}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link href="/login" className="flex-1 text-center text-sm font-medium py-2.5 border border-[#e5e5e5] rounded">Sign in</Link>
              <Link href="/login" className="flex-1 text-center text-sm font-semibold py-2.5 bg-[#CC2200] text-white rounded">Get started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="anim-fade-up d-0 inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-[#e5e5e5] bg-white text-xs font-medium text-[#0a0a0a]/60">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Trusted by 500+ law enforcement agencies worldwide
          </div>

          <h1 className="anim-fade-up d-50 text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
            Expose deepfakes.{" "}
            <span className="shimmer-text">Protect truth.</span>
          </h1>

          <p className="anim-fade-up d-100 text-lg leading-relaxed text-[#0a0a0a]/60 mb-10 max-w-xl">
            DeepGuard is the professional investigation platform for detecting AI-generated media manipulation. Built for forensic analysts, journalists, and law enforcement.
          </p>

          <div className="anim-fade-up d-150 flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="btn-primary inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#CC2200] text-white font-semibold rounded text-sm hover:opacity-90 active:scale-[0.97] transition-all"
            >
              Start free investigation
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#e5e5e5] text-[#0a0a0a] font-medium rounded text-sm hover:bg-black/4 transition-colors"
            >
              See how it works
            </a>
          </div>

          {/* Stats row */}
          <div className="anim-fade-up d-300 mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#e5e5e5] rounded-lg overflow-hidden border border-[#e5e5e5]">
            {stats.map((s, i) => (
              <div key={i} className="bg-white px-6 py-5 flex flex-col gap-1">
                <span className="text-2xl font-bold tracking-tight">{s.value}</span>
                <span className="text-xs text-[#0a0a0a]/50 font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo Preview ─── */}
      <section className="px-6 max-w-6xl mx-auto mb-24">
        <div className="anim-scale-in d-200 rounded-lg border border-[#e5e5e5] bg-white overflow-hidden shadow-xl">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#f0f0f0] bg-[#fafafa]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
            <div className="flex-1 mx-4 h-5 bg-[#f0f0f0] rounded-full flex items-center px-3">
              <span className="text-[10px] text-[#0a0a0a]/40 font-mono">app.deepguard.io/dashboard</span>
            </div>
          </div>
          {/* Dashboard mockup */}
          <div className="grid grid-cols-4 min-h-[340px]">
            {/* Sidebar */}
            <div className="col-span-1 border-r border-[#f0f0f0] p-4 flex flex-col gap-1 bg-white">
              {[
                { icon: "◉", label: "Overview", active: true },
                { icon: "⬡", label: "Investigations" },
                { icon: "▣", label: "Evidence" },
                { icon: "⊕", label: "Reports" },
                { icon: "⊙", label: "Settings" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium cursor-default transition-colors ${
                    item.active ? "bg-[#CC2200]/8 text-[#CC2200]" : "text-[#0a0a0a]/50 hover:bg-[#f5f5f5]"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="hidden sm:block">{item.label}</span>
                </div>
              ))}
            </div>
            {/* Main content */}
            <div className="col-span-3 p-5 bg-[#fafafa]">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Active Cases", value: "24", color: "#CC2200" },
                  { label: "Confirmed Fakes", value: "186", color: "#059669" },
                  { label: "Pending Review", value: "12", color: "#d97706" },
                ].map((card) => (
                  <div key={card.label} className="card-pop bg-white border border-[#f0f0f0] rounded p-3">
                    <div className="text-[10px] font-medium text-[#0a0a0a]/50 mb-1">{card.label}</div>
                    <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>
              {/* Fake activity bars */}
              <div className="bg-white border border-[#f0f0f0] rounded p-4">
                <div className="text-[10px] font-semibold text-[#0a0a0a]/50 mb-3 uppercase tracking-wider">Detection Activity</div>
                <div className="flex items-end gap-1.5 h-16">
                  {[40, 65, 30, 85, 55, 70, 45, 90, 60, 75, 50, 80].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm chart-reveal"
                      style={{
                        height: `${h}%`,
                        backgroundColor: i === 9 ? "#CC2200" : "#CC2200" + "33",
                        animationDelay: `${i * 50}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="px-6 max-w-6xl mx-auto py-24 border-t border-[#e5e5e5]">
        <div className="mb-14">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#CC2200] mb-3">Platform Features</div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Everything you need to investigate deepfakes
          </h2>
          <p className="text-base text-[#0a0a0a]/55 max-w-lg leading-relaxed">
            Purpose-built tools for forensic investigators, media professionals, and security researchers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="feature-cell card-pop bg-white border border-[#e5e5e5] rounded-lg p-6"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="w-9 h-9 flex items-center justify-center bg-[#CC2200]/8 text-[#CC2200] rounded mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-base mb-2 tracking-tight">{f.title}</h3>
              <p className="text-sm text-[#0a0a0a]/55 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="bg-white border-y border-[#e5e5e5] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#CC2200] mb-3">How it works</div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              From upload to verdict in minutes
            </h2>
            <p className="text-base text-[#0a0a0a]/55 max-w-lg leading-relaxed">
              Our streamlined workflow gets you from raw media to courtroom-ready evidence quickly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="card-pop" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="font-mono text-xs font-bold text-[#CC2200]/60 mb-3 tracking-widest">{step.num}</div>
                <div className="w-px h-8 bg-[#e5e5e5] mb-3 ml-px" />
                <h3 className="font-semibold text-base mb-2 tracking-tight">{step.title}</h3>
                <p className="text-sm text-[#0a0a0a]/55 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 px-6 max-w-3xl mx-auto text-center">
        <div className="anim-fade-up">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to investigate?
          </h2>
          <p className="text-base text-[#0a0a0a]/55 leading-relaxed mb-8">
            Join thousands of investigators using DeepGuard to protect truth and expose AI manipulation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#CC2200] text-white font-semibold rounded text-sm hover:opacity-90 transition-all active:scale-[0.97]"
            >
              Start free — no credit card
            </Link>
            <a href="mailto:contact@deepguard.io" className="inline-flex items-center justify-center px-8 py-3.5 border border-[#e5e5e5] text-sm font-medium rounded hover:bg-black/4 transition-colors">
              Talk to sales
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#e5e5e5] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#CC2200] rounded flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-semibold text-sm">DeepGuard</span>
          </div>
          <p className="text-xs text-[#0a0a0a]/40">
            © {new Date().getFullYear()} DeepGuard. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-[#0a0a0a]/50">
            <a href="#" className="hover:text-[#0a0a0a] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#0a0a0a] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#0a0a0a] transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

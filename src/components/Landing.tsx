"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* ── Inline SVG icon set for About / FAQs ── */
function IconSearch() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function IconSliders() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconCpu() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M9 7V4M12 7V4M15 7V4M9 20v-3M12 20v-3M15 20v-3M7 9H4M7 12H4M7 15H4M20 9h-3M20 12h-3M20 15h-3" />
    </svg>
  );
}
function IconBookmark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}
function IconGraduation() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3.333 1.667 8.667 1.667 12 0v-5" />
    </svg>
  );
}

const steps = [
  {
    number: 1,
    title: "Browse the Directory",
    description:
      "Search and filter through DCISM's curated list of industry partners by industry, specialization, role, and location to find companies that match your interests and practicum requirements.",
  },
  {
    number: 2,
    title: "Save & Compare",
    description:
      "Bookmark companies that align with your practicum requirements. Compare multiple companies side-by-side to make a confident, well-informed decision before applying.",
  },
  {
    number: 3,
    title: "Practice Mock Interviews",
    description:
      "Prepare with AI-powered category-based mock interviews. Get personalized feedback on technical, behavioral, and situational responses tailored to your target industry.",
  },
];

const faqs = [
  {
    q: "Who can use GetHired?",
    a: "GetHired is built exclusively for DCISM students preparing for their OJT or practicum. Only verified DCISM students can create an account and access the full directory and interview tools.",
  },
  {
    q: "Are the companies listed verified industry partners?",
    a: "Yes. Every company in the directory is an official DCISM industry partner accredited by the department. The list is reviewed and updated each semester to reflect current opportunities.",
  },
  {
    q: "How does the AI mock interview work?",
    a: "Select a category that matches your target company's specialization, answer technical or behavioral questions, then receive AI-generated feedback evaluating your response's structure, completeness, and relevance.",
  },
  {
    q: "Can I save companies to apply to later?",
    a: "Absolutely. Bookmark any company from the directory and access your saved list from your dashboard's Home view anytime. Saved companies persist across sessions.",
  },
  {
    q: "Is GetHired free for DCISM students?",
    a: "Yes, GetHired is completely free for all enrolled DCISM students. The platform is provided as part of the department's support for student practicum and career readiness.",
  },
];

/* ── Hero & Mockup SVG Icons ── */
function IconCompass() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconMiniBookmark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconCheckBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

type NavId = "home" | "about" | "faqs" | "how-it-works";

export default function Landing({ onLogin }: { onLogin?: () => void } = {}) {
  const router = useRouter();
  const handleLogin = onLogin ?? (() => router.push("/login"));
  const [activeNav, setActiveNav] = useState<NavId>("home");
  const [currentStep, setCurrentStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mockSidebarCollapsed, setMockSidebarCollapsed] = useState(false);

  const scrollTo = (id: NavId) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-[#F9FAFB] text-slate-800" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      {/* ══════ 2. FLOATING GLASS NAVBAR (Extra-long full-bleed width, 68px height) ══════ */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 sm:px-5 pt-5 sm:pt-6 pointer-events-none">
        <nav
          className="pointer-events-auto w-full max-w-[1520px] h-[64px] sm:h-[68px] rounded-full px-4 sm:px-8 md:px-12 flex items-center justify-between transition-all select-none"
          style={{
            background: "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(226, 232, 240, 0.75)",
            boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Left: Brand title "GetHired" in bold royal blue (#0066FF) */}
          <button
            onClick={() => scrollTo("home")}
            className="cursor-pointer text-left focus:outline-none flex items-center gap-2 group shrink-0"
          >
            <img
              src="/getHiredLogo.png"
              alt="GetHired Logo"
              className="w-9 h-9 sm:w-12 sm:h-12 object-contain shrink-0 group-hover:opacity-90 transition-opacity"
            />
            <span
              className="text-[#0066FF] font-bold text-[20px] sm:text-[24px] tracking-tight group-hover:opacity-90 transition-opacity"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              GetHired
            </span>
          </button>

          {/* Center: Links "Home", "About", "FAQs" with generous wide spacing */}
          <div className="hidden sm:flex items-center gap-12 md:gap-20">
            <button
              onClick={() => scrollTo("home")}
              className={`text-[15px] font-medium transition-colors cursor-pointer ${
                activeNav === "home" ? "text-[#0066FF] font-semibold" : "text-[#475569] hover:text-[#0066FF]"
              }`}
            >
              Home
            </button>
            <button
              onClick={() => scrollTo("about")}
              className={`text-[15px] font-medium transition-colors cursor-pointer ${
                activeNav === "about" ? "text-[#0066FF] font-semibold" : "text-[#475569] hover:text-[#0066FF]"
              }`}
            >
              About
            </button>
            <button
              onClick={() => scrollTo("faqs")}
              className={`text-[15px] font-medium transition-colors cursor-pointer ${
                activeNav === "faqs" ? "text-[#0066FF] font-semibold" : "text-[#475569] hover:text-[#0066FF]"
              }`}
            >
              FAQs
            </button>
          </div>

          {/* Right: Pill CTA button in solid royal blue (#0066FF), white text "Student Portal", padding: 8px 20px, rounded-full */}
          <button
            onClick={handleLogin}
            className="bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] sm:text-[15px] font-medium px-4 sm:px-7 py-2 sm:py-2.5 rounded-full transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          >
            Student Portal
          </button>
        </nav>
      </div>

      {/* ══════ 1 & 3. HERO COPY, ACTIONS & DEEP FRAMELESS SCREEN CASCADE ══════ */}
      <section
        id="home"
        className="relative overflow-hidden pt-24 sm:pt-28 md:pt-32 pb-24 sm:pb-36 flex flex-col items-center w-full"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 65%, #FFFFFF 100%)",
        }}
      >
        {/* 3. Hero Copy & Actions */}
        <div className="text-center px-4 sm:px-6 max-w-6xl mx-auto shrink-0 z-20">
          {/* Headline: responsive font size, single line on sm+ */}
          <h1
            className="text-[#0F172A] font-bold text-[24px] xs:text-[28px] sm:text-[38px] md:text-[44px] lg:text-[46px] leading-[1.15] tracking-tight sm:whitespace-nowrap mx-auto"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            Your DCISM internship search, simplified.
          </h1>

          {/* Subtitle: 15px Regular, slate-500 (#64748B), max-width 720px, centered */}
          <p className="mt-3 sm:mt-3.5 text-[13px] sm:text-[15px] text-[#64748B] max-w-[720px] mx-auto leading-relaxed font-normal px-2">
            Direct access to 362+ verified industry partners, standardized OJT details, and role-based technical mock interviews in one place.
          </p>

          {/* Action Buttons: Solid royal blue pill + ghost frosted pill */}
          <div className="mt-5 sm:mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
            <button
              onClick={handleLogin}
              className="bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] sm:text-[14px] font-semibold px-5 sm:px-7 py-2.5 sm:py-3 rounded-full shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 cursor-pointer"
            >
              Explore 362+ Partners
            </button>
            <button
              onClick={() => scrollTo("how-it-works")}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] text-[13px] sm:text-[14px] font-medium px-5 sm:px-7 py-2.5 sm:py-3 rounded-full transition-all shadow-2xs active:scale-95 cursor-pointer"
            >
              Practice Interviews
            </button>
          </div>
        </div>

        {/* ══════ 4. DEEP FRAMELESS SCREEN CASCADE (EXPANDED MONITOR & FADED CUT-OFF) ══════ */}
        <div className="relative w-full max-w-6xl sm:max-w-7xl mx-auto px-2 sm:px-4 mt-16 sm:mt-20 flex justify-center items-center">
          
          {/* Subtle Ambient Background Glow Behind Mockups */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[1100px] h-[380px] sm:h-[520px] bg-gradient-to-tr from-blue-500/10 via-sky-400/8 to-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

          <div className="relative w-full flex items-center justify-center">

            {/* ── LEFT BACKGROUND SCREEN (Mock Interview Results - 3D Tilt & Scale) ── */}
            <div
              className="absolute left-1/2 top-1/2 hidden lg:block z-0 pointer-events-none select-none transition-transform"
              style={{
                transform: "translateX(calc(-50% - min(370px, 25vw))) translateY(-50%) scale(0.92) rotate(-2.5deg)",
                transformOrigin: "center center",
                opacity: 0.60,
              }}
            >
              <div className="w-[800px] bg-white rounded-[24px] p-5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.30)] border border-slate-200/90 ring-1 ring-slate-900/5">
                {/* Header Back button */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5 text-[12px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-[#0066FF] font-medium">
                    <span>←</span>
                    <span>Back to categories</span>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 font-semibold px-2.5 py-0.5 rounded-full text-[10px]">
                    Evaluation Ready
                  </span>
                </div>

                {/* Overall Score Banner (Dashboard UI) */}
                <div className="bg-[#0066FF] rounded-[20px] p-4 flex items-center gap-4 mb-4 text-white shadow-sm">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shrink-0 shadow-md">
                    <span className="text-[#0066FF] text-[24px] font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
                      92
                    </span>
                  </div>
                  <div>
                    <div className="text-white/70 text-[9.5px] uppercase tracking-wider font-semibold">Overall AI Score</div>
                    <div className="text-[18px] font-bold leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                      Outstanding Interview!
                    </div>
                    <div className="text-white/80 text-[11px] mt-0.5">
                      Web Development · 5 questions evaluated by AI
                    </div>
                  </div>
                </div>

                {/* Phase Breakdown List */}
                <div className="space-y-2.5">
                  {[
                    { phase: "INTRODUCTION", question: "Tell us about yourself and your technical background.", score: 94, feedback: "Excellent articulation of university projects, stack competencies, and career goals." },
                    { phase: "SITUATIONAL", question: "Describe how you handled conflicting architectural opinions in a team.", score: 90, feedback: "Demonstrated strong empathy, objective benchmark testing, and consensus building." },
                    { phase: "TECHNICAL", question: "Explain React reconciliation and the virtual DOM tree diffing algorithm.", score: 92, feedback: "Clear distinction between reconciliation and commit phases with Fiber architecture." },
                  ].map((res, i) => (
                    <div key={i} className="bg-slate-50 rounded-[16px] p-3 border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{res.phase}</span>
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center justify-center">
                          {res.score}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-700 mb-1.5">{res.question}</div>
                      <div className="bg-white rounded-[10px] p-2 text-[10px] text-slate-500 border border-slate-100 flex items-start gap-1.5">
                        <span className="text-[#0066FF] font-bold">AI:</span>
                        <span>{res.feedback}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT BACKGROUND SCREEN (Active Live Mock Interview - 3D Tilt & Scale) ── */}
            <div
              className="absolute left-1/2 top-1/2 hidden lg:block z-0 pointer-events-none select-none transition-transform"
              style={{
                transform: "translateX(calc(-50% + min(370px, 25vw))) translateY(-50%) scale(0.92) rotate(2.5deg)",
                transformOrigin: "center center",
                opacity: 0.60,
              }}
            >
              <div className="w-[800px] bg-white rounded-[24px] p-5 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.30)] border border-slate-200/90 ring-1 ring-slate-900/5">
                {/* Header Track */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0066FF] animate-pulse"></div>
                    <span className="text-[16px] font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
                      Web Development Interview
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Active Session
                    </span>
                    <span className="text-[11px] text-slate-400">Phase 2 of 5</span>
                  </div>
                </div>

                {/* Stepper (Dashboard UI Style) */}
                <div className="flex items-center gap-1.5 mb-4 bg-slate-50 rounded-[14px] p-1.5 border border-slate-100">
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-emerald-600 bg-emerald-50">✓ Intro</div>
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#0066FF] text-white shadow-2xs">2. Technical</div>
                  <div className="px-2.5 py-1 rounded-lg text-[10px] text-slate-400">3. Coding</div>
                  <div className="px-2.5 py-1 rounded-lg text-[10px] text-slate-400">4. Situational</div>
                  <div className="px-2.5 py-1 rounded-lg text-[10px] text-slate-400">5. Q&A</div>
                </div>

                {/* Active Question Box */}
                <div className="bg-slate-50 rounded-[18px] p-4 border border-slate-200/80 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-semibold bg-blue-100 text-[#0066FF] px-2 py-0.5 rounded-full">
                      Technical Question
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-[#0F172A] leading-relaxed mb-3">
                    Explain how browser caching mechanisms (Cache-Control, ETag, and stale-while-revalidate) optimize single-page applications.
                  </p>
                  <div className="bg-blue-50/80 rounded-[12px] p-2.5 text-[10.5px] text-[#0066FF] flex items-start gap-1.5">
                    <span>💡</span>
                    <span>Tip: Focus on cache revalidation HTTP headers and service worker offline caching strategies.</span>
                  </div>
                </div>

                {/* Answer Area */}
                <div className="bg-white rounded-[16px] p-3.5 border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-700 mb-2">Candidate Response:</div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] text-slate-600 font-mono leading-relaxed mb-3 border border-slate-100">
                    &ldquo;HTTP Cache-Control max-age dictates immediate cache validity, while ETags provide cryptographic validation hashes with 304 Not Modified status...&rdquo;
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">184 characters · AI evaluation ready</span>
                    <span className="bg-[#0066FF] text-white text-[11px] font-semibold px-4 py-1.5 rounded-full shadow-xs">
                      Submit for Evaluation →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CENTER FOREGROUND SCREEN (Frameless bottom, delayed fade) ── */}
            <div
              className="relative w-full max-w-[1040px] lg:max-w-[1080px] z-10 select-none"
            >
              {/* Computer Display Bezel — no bottom black border, 1-inch bottom fade only */}
              <div
                className="bg-[#0F172A] rounded-t-[26px] sm:rounded-t-[34px] rounded-b-none p-2.5 sm:p-3.5 pb-0 border-t border-x border-b-0 border-slate-700/80 shadow-2xl"
                style={{
                  maskImage: "linear-gradient(to bottom, black 87%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 87%, transparent 100%)",
                }}
              >
                {/* Discreet Top Center Camera Dot */}
                <div className="h-1.5 sm:h-2 flex items-center justify-center mb-1">
                  <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-slate-700"></div>
                </div>

                {/* Inner Dashboard UI Container — flush layout so sidebar is continuous */}
                <div className="bg-[#F8FAFC] rounded-t-[18px] sm:rounded-t-[24px] rounded-b-none border-t border-x border-b-0 border-slate-200/60 flex gap-0 overflow-hidden text-left shadow-inner">
                
                {/* Left Nav Rail — continuous flush panel, no floating card */}
                {/* Left Nav Rail — continuous flush panel, collapses on clicking logo */}
                <aside
                  className={`shrink-0 bg-white rounded-tl-[18px] sm:rounded-tl-[24px] py-2.5 sm:py-4 flex flex-col self-stretch select-none border-r border-slate-100 z-10 transition-all duration-300 ${
                    mockSidebarCollapsed ? "w-14 sm:w-[72px] px-2.5 sm:px-3.5" : "w-12 sm:w-[180px] px-2 sm:px-3"
                  }`}
                >
                  <div>
                    {/* Brand Logo — clickable to collapse/expand mockup sidebar */}
                    <button
                      type="button"
                      onClick={() => setMockSidebarCollapsed((v) => !v)}
                      title={mockSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                      className={`w-full mb-2 sm:mb-4 flex items-center cursor-pointer transition-all hover:opacity-80 ${
                        mockSidebarCollapsed ? "justify-center px-0" : "px-1 sm:px-1.5 justify-center sm:justify-start gap-2"
                      }`}
                    >
                      <img
                        src="/getHiredLogo.png"
                        alt="GetHired Logo"
                        className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
                      />
                      {!mockSidebarCollapsed && (
                        <span
                          className="hidden sm:inline text-[18px] font-bold text-[#0066FF] tracking-tight"
                          style={{ fontFamily: "'DM Serif Display', serif" }}
                        >
                          GetHired
                        </span>
                      )}
                    </button>

                    {/* Nav items */}
                    <div className="space-y-1.5 sm:space-y-2">
                      {/* Home (Active) */}
                      <div className={`flex items-center gap-2.5 py-2 rounded-full text-[12.5px] font-semibold bg-[#0066FF] text-white shadow-xs transition-all ${
                        mockSidebarCollapsed ? "justify-center px-0" : "justify-center sm:justify-start px-2 sm:px-3.5"
                      }`}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5zM9 21V12h6v9" />
                        </svg>
                        {!mockSidebarCollapsed && <span className="hidden sm:inline">Home</span>}
                      </div>

                      {/* Explore */}
                      <div className={`flex items-center gap-2.5 py-2 rounded-full text-[12.5px] font-medium text-gray-500 hover:text-[#0066FF] hover:bg-[#dfe9ff] transition-all cursor-pointer ${
                        mockSidebarCollapsed ? "justify-center px-0" : "justify-center sm:justify-start px-2 sm:px-3.5"
                      }`}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                        </svg>
                        {!mockSidebarCollapsed && <span className="hidden sm:inline">Explore</span>}
                      </div>

                      {/* Interview */}
                      <div className={`flex items-center gap-2.5 py-2 rounded-full text-[12.5px] font-medium text-gray-500 hover:text-[#0066FF] hover:bg-[#dfe9ff] transition-all cursor-pointer ${
                        mockSidebarCollapsed ? "justify-center px-0" : "justify-center sm:justify-start px-2 sm:px-3.5"
                      }`}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" />
                        </svg>
                        {!mockSidebarCollapsed && <span className="hidden sm:inline">Interview</span>}
                      </div>
                    </div>
                  </div>

                  {/* Extended empty area so the sidebar bottom stays continuous into the fade */}
                  <div className="flex-1 min-h-[96px] sm:min-h-[128px]" />
                </aside>

                {/* Main View Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-2.5 sm:p-4 pb-24 sm:pb-32">
                  
                  {/* Top Bar with Search & Top-Right Profile Pill */}
                  <div className="flex items-center justify-between pb-2.5 sm:pb-3 shrink-0 border-b border-slate-100 mb-2.5 sm:mb-3 gap-2">
                    <div className="flex items-center gap-2 bg-white rounded-full px-3 sm:px-3.5 py-1.5 border border-slate-200 text-[10.5px] sm:text-[11.5px] text-slate-400 flex-1 max-w-[220px] sm:max-w-[320px] shadow-2xs truncate">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                      </svg>
                      <span className="truncate">Search 362+ partners...</span>
                    </div>

                    {/* Top-Right Profile Pill: "Ishie Boo" with blue avatar "I" */}
                    <div className="bg-white rounded-full px-2.5 sm:px-3.5 py-1.5 shadow-2xs border border-slate-100 flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block leading-tight">
                        <div className="text-[11.5px] font-semibold text-[#0F172A]">Ishie Boo</div>
                        <div className="text-[9.5px] text-slate-400">Information Technology</div>
                      </div>
                      <div className="w-[22px] sm:w-[26px] h-[22px] sm:h-[26px] bg-[#0066FF] text-white rounded-full flex items-center justify-center font-bold text-[10.5px] sm:text-[11.5px] shadow-xs shrink-0">
                        I
                      </div>
                    </div>
                  </div>

                  {/* Header: "Welcome, Ishie!" */}
                  <div className="shrink-0 mb-2.5 sm:mb-3.5">
                    <h2
                      className="text-[18px] sm:text-[24px] font-bold text-[#0F172A] leading-tight"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      Welcome, Ishie!
                    </h2>
                    <p className="text-[10.5px] sm:text-[11.5px] text-slate-500 mt-0.5 truncate">
                      Showing verified industry partners & active categories
                    </p>
                  </div>

                  {/* Three light-blue metric pills: 362 Industry Partners, 3 Saved Companies, 11 Interview Categories */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3.5 mb-2.5 sm:mb-3.5 shrink-0">
                    <div className="bg-[#EEF5FF] border border-[#E0EDFF] rounded-[12px] sm:rounded-[15px] p-2 sm:p-3 flex items-center gap-2 sm:gap-2.5">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 21h18M3 7l9-4 9 4M4 21V7m16 14V7M9 21v-4h6v4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-[16px] font-bold text-[#0F172A] leading-none" style={{ fontFamily: "'DM Serif Display', serif" }}>
                          362
                        </div>
                        <div className="text-[8.5px] sm:text-[9.5px] text-slate-500 mt-0.5 font-medium truncate">
                          <span className="hidden sm:inline">Industry </span>Partners
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#EEF5FF] border border-[#E0EDFF] rounded-[12px] sm:rounded-[15px] p-2 sm:p-3 flex items-center gap-2 sm:gap-2.5">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-[16px] font-bold text-[#0F172A] leading-none" style={{ fontFamily: "'DM Serif Display', serif" }}>
                          3
                        </div>
                        <div className="text-[8.5px] sm:text-[9.5px] text-slate-500 mt-0.5 font-medium truncate">
                          <span className="hidden sm:inline">Saved </span>Companies
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#EEF5FF] border border-[#E0EDFF] rounded-[12px] sm:rounded-[15px] p-2 sm:p-3 flex items-center gap-2 sm:gap-2.5">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z" /><path d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] sm:text-[16px] font-bold text-[#0F172A] leading-none" style={{ fontFamily: "'DM Serif Display', serif" }}>
                          11
                        </div>
                        <div className="text-[8.5px] sm:text-[9.5px] text-slate-500 mt-0.5 font-medium truncate">
                          <span className="hidden sm:inline">Interview </span>Categories
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saved Partner Cards row: Full Scale, Hatchit Solutions, Skanlog (NO SLOTS BADGES) */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {/* Card 1: Full Scale */}
                    <div className="bg-white rounded-[13px] sm:rounded-[16px] border border-slate-100 p-2 sm:p-3 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="relative h-[56px] sm:h-[84px] rounded-[9px] sm:rounded-[11px] overflow-hidden bg-slate-100">
                          <img
                            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=260&fit=crop&auto=format"
                            alt="Full Scale"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center shadow-xs">
                            <svg width="8" height="8" className="sm:w-2.5 sm:h-2.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                            </svg>
                          </div>
                        </div>
                        <h4 className="text-[11px] sm:text-[13.5px] font-bold text-[#0F172A] mt-1.5 leading-tight truncate" style={{ fontFamily: "'DM Serif Text', serif" }}>
                          Full Scale
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="bg-[#EEF5FF] text-[#0066FF] text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-full">
                            Software Dev
                          </span>
                          <span className="hidden sm:inline bg-[#EEF5FF] text-[#0066FF] text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                            Full-Stack
                          </span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8.5px] sm:text-[9.5px] text-slate-400 mt-1.5">
                        <span className="truncate">Cebu IT Park</span>
                      </div>
                    </div>

                    {/* Card 2: Hatchit Solutions */}
                    <div className="bg-white rounded-[13px] sm:rounded-[16px] border border-slate-100 p-2 sm:p-3 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="relative h-[56px] sm:h-[84px] rounded-[9px] sm:rounded-[11px] overflow-hidden bg-slate-100">
                          <img
                            src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=260&fit=crop&auto=format"
                            alt="Hatchit Solutions"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center shadow-xs">
                            <svg width="8" height="8" className="sm:w-2.5 sm:h-2.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                            </svg>
                          </div>
                        </div>
                        <h4 className="text-[11px] sm:text-[13.5px] font-bold text-[#0F172A] mt-1.5 leading-tight truncate" style={{ fontFamily: "'DM Serif Text', serif" }}>
                          Hatchit Solutions
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="bg-[#EEF5FF] text-[#0066FF] text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-full">
                            Mobile & Web
                          </span>
                          <span className="hidden sm:inline bg-[#EEF5FF] text-[#0066FF] text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                            UI/UX Design
                          </span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8.5px] sm:text-[9.5px] text-slate-400 mt-1.5">
                        <span className="truncate">Cebu City</span>
                      </div>
                    </div>

                    {/* Card 3: Skanlog */}
                    <div className="bg-white rounded-[13px] sm:rounded-[16px] border border-slate-100 p-2 sm:p-3 shadow-2xs flex flex-col justify-between">
                      <div>
                        <div className="relative h-[56px] sm:h-[84px] rounded-[9px] sm:rounded-[11px] overflow-hidden bg-slate-100">
                          <img
                            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=260&fit=crop&auto=format"
                            alt="Skanlog"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#0066FF] text-white flex items-center justify-center shadow-xs">
                            <svg width="8" height="8" className="sm:w-2.5 sm:h-2.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
                            </svg>
                          </div>
                        </div>
                        <h4 className="text-[11px] sm:text-[13.5px] font-bold text-[#0F172A] mt-1.5 leading-tight truncate" style={{ fontFamily: "'DM Serif Text', serif" }}>
                          Skanlog
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="bg-[#EEF5FF] text-[#0066FF] text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-full">
                            Enterprise Dev
                          </span>
                          <span className="hidden sm:inline bg-[#EEF5FF] text-[#0066FF] text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                            Cloud / DevOps
                          </span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[8.5px] sm:text-[9.5px] text-slate-400 mt-1.5">
                        <span className="truncate">Mandaue City</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
              {/* Solid whiter 1-inch bottom fade — blends monitor into page */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 sm:h-28 bg-gradient-to-b from-white/0 via-white/90 to-white" />
            </div>
          </div>

        </div>
        </div>
      </section>

      {/* ══════ SECTION 2 — ABOUT ══════ */}
      <section id="about" className="min-h-screen flex items-center px-4 sm:px-8 py-16 sm:py-24 max-w-[1520px] mx-auto w-full">
        <div className="bg-[#dfe9ff] rounded-[28px] sm:rounded-[40px] lg:rounded-[45px] w-full p-6 sm:p-10 lg:p-16">

          <div className="mb-8 sm:mb-12">
            <span className="text-[#0073ff] text-[11px] font-semibold uppercase tracking-[3px] sm:tracking-[4px] block mb-3 sm:mb-4">
              About GetHired
            </span>
            <h2
              className="text-[#302929] leading-[1.15] sm:leading-tight tracking-[-1px] sm:tracking-[-2px] max-w-3xl mb-4 sm:mb-5 text-[26px] xs:text-[32px] sm:text-[42px] md:text-[52px] lg:text-[60px] break-words"
              style={{
                fontFamily: "'DM Serif Display', serif",
              }}
            >
              Everything you need for your OJT journey.
            </h2>
            <p className="text-gray-500 sm:text-gray-400 text-[14.5px] sm:text-[17px] max-w-xl leading-relaxed">
              GetHired handles the research and preparation so you can focus on what
              actually matters — landing the placement you deserve.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {[
              {
                icon: <IconSearch />,
                title: "Centralized Directory",
                body: "All DCISM industry partners in one searchable, filterable place. No more hunting through multiple platforms, asking around, or relying on outdated spreadsheets.",
              },
              {
                icon: <IconSliders />,
                title: "Smart Filtering",
                body: "Filter by industry, specialization, role, and location. Narrow down companies that genuinely fit your practicum requirements and academic track in seconds.",
              },
              {
                icon: <IconCpu />,
                title: "AI Mock Interviews",
                body: "Practice technical and behavioral questions tailored to your target industry. Receive AI-powered feedback so you walk into every interview prepared.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 hover:shadow-md transition-shadow"
              >
                <div className="text-[#0073ff] mb-4 sm:mb-5">{card.icon}</div>
                <h3
                  className="text-[18px] sm:text-[20px] text-[#232323] mb-2 sm:mb-3"
                  style={{ fontFamily: "'DM Serif Text', serif" }}
                >
                  {card.title}
                </h3>
                <p className="text-[13.5px] sm:text-[14px] text-gray-500 sm:text-gray-400 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="col-span-1 md:col-span-2 bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 hover:shadow-md transition-shadow">
              <div className="text-[#0073ff] mb-4 sm:mb-5"><IconBookmark /></div>
              <h3
                className="text-[18px] sm:text-[20px] text-[#232323] mb-2 sm:mb-3"
                style={{ fontFamily: "'DM Serif Text', serif" }}
              >
                Save & Compare Companies
              </h3>
              <p className="text-[13.5px] sm:text-[14px] text-gray-500 sm:text-gray-400 leading-relaxed max-w-lg">
                Bookmark your top picks and compare them side-by-side based on
                specializations, requirements, and location. Build your shortlist before committing
                to applications.
              </p>
            </div>
            <div className="col-span-1 bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 hover:shadow-md transition-shadow">
              <div className="text-[#0073ff] mb-4 sm:mb-5"><IconGraduation /></div>
              <h3
                className="text-[18px] sm:text-[20px] text-[#232323] mb-2 sm:mb-3"
                style={{ fontFamily: "'DM Serif Text', serif" }}
              >
                DCISM-Specific
              </h3>
              <p className="text-[13.5px] sm:text-[14px] text-gray-500 sm:text-gray-400 leading-relaxed">
                Built exclusively for DCISM students and their unique practicum requirements
                and curriculum tracks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ SECTION 3 — HOW IT WORKS ══════ */}
      <section id="how-it-works" className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-8 py-16 sm:py-24 bg-white">
        <div className="w-full max-w-[720px]">
          <span className="text-[#4869ff] text-[11px] font-semibold uppercase tracking-[3px] sm:tracking-[4px] block text-center mb-3 sm:mb-4">
            How It Works
          </span>
          <h2
            className="text-[#302929] text-center leading-[1.15] sm:leading-tight tracking-[-1px] sm:tracking-[-2px] mb-3 sm:mb-4 text-[26px] xs:text-[32px] sm:text-[42px] md:text-[52px] break-words"
            style={{
              fontFamily: "'DM Serif Display', serif",
            }}
          >
            Three steps to your ideal placement.
          </h2>
          <p className="text-gray-400 text-[14px] sm:text-[16px] text-center mb-8 sm:mb-16 max-w-md mx-auto leading-relaxed">
            GetHired simplifies the OJT search from discovery to interview preparation.
          </p>

          <div className="relative">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              aria-label="Previous step"
              className="hidden sm:flex absolute left-[-60px] top-1/2 -translate-y-1/2 w-12 h-12 bg-[#0073ff] rounded-full items-center justify-center text-white hover:bg-[#0052cc] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-200 z-10 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="block -translate-x-[1px]">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="bg-[#4869ff] rounded-[32px] sm:rounded-[45px] overflow-hidden">
              <div className="bg-white mx-3 sm:mx-5 mt-3 sm:mt-5 rounded-[22px] sm:rounded-[35px] px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#4869ff] rounded-full flex items-center justify-center shrink-0 shadow-md">
                  <span
                    className="text-white text-[16px] sm:text-[18px] font-bold"
                    style={{ fontFamily: "'DM Serif Display', serif" }}
                  >
                    {steps[currentStep].number}
                  </span>
                </div>
                <span
                  className="text-[#302929] text-[15px] sm:text-[18px] font-semibold truncate"
                  style={{ fontFamily: "'DM Serif Text', serif" }}
                >
                  {steps[currentStep].title}
                </span>
                <div className="ml-auto hidden sm:flex gap-2">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === currentStep ? "bg-[#4869ff] w-6" : "bg-gray-200 w-2"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-white mx-3 sm:mx-5 mb-3 sm:mb-5 mt-3 sm:mt-4 rounded-[22px] sm:rounded-[35px] p-5 sm:p-10 min-h-[160px] sm:min-h-[200px] flex flex-col justify-between">
                <p className="text-[14px] sm:text-[16px] text-gray-500 leading-relaxed">
                  {steps[currentStep].description}
                </p>
                {steps[currentStep].number === 3 && (
                  <div className="mt-5 sm:mt-6 pt-2">
                    <button
                      onClick={handleLogin}
                      className="inline-flex items-center gap-2 bg-[#0066FF] hover:bg-[#0052cc] text-white font-semibold text-[13.5px] sm:text-[14px] px-6 py-2.5 rounded-full transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 active:scale-98 cursor-pointer group"
                    >
                      <span>Get started</span>
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              aria-label="Next step"
              className="hidden sm:flex absolute right-[-60px] top-1/2 -translate-y-1/2 w-12 h-12 bg-[#0073ff] rounded-full items-center justify-center text-white text-2xl font-bold hover:bg-[#0052cc] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-200 z-10 cursor-pointer"
            >
              ›
            </button>

            {/* Mobile navigation controls */}
            <div className="flex items-center justify-between mt-4 sm:hidden px-1">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                aria-label="Previous step"
                className="px-4 py-2 bg-[#0073ff] rounded-full text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm cursor-pointer"
              >
                ‹ Prev
              </button>
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === currentStep ? "bg-[#4869ff] w-5" : "bg-gray-200 w-2"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                disabled={currentStep === steps.length - 1}
                aria-label="Next step"
                className="px-4 py-2 bg-[#0073ff] rounded-full text-white text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm cursor-pointer"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ SECTION 4 — FAQs ══════ */}
      <section
        id="faqs"
        className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 py-16 sm:py-24 bg-[#f8faff]"
      >
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 xl:gap-24 w-full max-w-[1300px] mx-auto items-start">

          {/* Left sticky overview */}
          <div className="w-full lg:w-[38%] shrink-0 lg:sticky lg:top-12">
            <span className="text-[#0073ff] text-[11px] font-semibold uppercase tracking-[3px] sm:tracking-[4px] block mb-3 sm:mb-6">
              FAQs
            </span>
            <h2
              className="text-[#302929] leading-[1.15] sm:leading-tight tracking-[-1px] sm:tracking-[-2px] mb-4 sm:mb-6 text-[26px] xs:text-[32px] sm:text-[40px] lg:text-[48px] break-words"
              style={{
                fontFamily: "'DM Serif Display', serif",
              }}
            >
              An overview of the FAQs
            </h2>
            <p className="text-gray-500 sm:text-gray-400 text-[14px] sm:text-[16px] leading-relaxed mb-6 sm:mb-10">
              Common questions from DCISM students about finding their ideal OJT company,
              understanding the platform, and making the most of AI-powered interview
              preparation.
            </p>
            <button
              onClick={handleLogin}
              className="w-full sm:w-auto text-center bg-[#0073ff] text-white font-semibold text-[14px] px-8 sm:px-9 py-3 sm:py-3.5 rounded-full hover:bg-[#0060dd] transition-all shadow-md shadow-blue-100 cursor-pointer active:scale-98"
            >
              Get Started →
            </button>

            <div className="mt-8 sm:mt-12 bg-[#dfe9ff] rounded-[22px] sm:rounded-[28px] p-5 sm:p-7 w-full">
              <div
                className="text-[#0073ff] text-[36px] sm:text-[48px] font-bold leading-none mb-1"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                300+
              </div>
              <div className="text-[12.5px] sm:text-[13px] text-gray-500">
                verified DCISM industry partners ready to browse
              </div>
            </div>
          </div>

          {/* Right accordion */}
          <div className="w-full lg:flex-1 flex flex-col gap-3 pt-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`rounded-[20px] sm:rounded-[24px] overflow-hidden border transition-all ${
                  openFaq === i
                    ? "border-[#b8d0ff] shadow-sm"
                    : "border-gray-100 hover:border-[#dfe9ff]"
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 sm:px-7 py-4 sm:py-6 flex justify-between items-center gap-4 sm:gap-6 bg-white cursor-pointer"
                >
                  <span className="font-semibold text-[14.5px] sm:text-[16px] text-[#302929] leading-snug">{faq.q}</span>
                  <span
                    className={`text-[#0073ff] text-2xl shrink-0 leading-none transition-transform duration-200 ${
                      openFaq === i ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 sm:px-7 pb-5 sm:pb-7 bg-white text-[13.5px] sm:text-[15px] text-gray-500 leading-relaxed border-t border-gray-50 pt-3 sm:pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="px-4 sm:px-8 lg:px-16 py-8 sm:py-10 bg-[#f8faff] border-t border-gray-100">
        <div className="max-w-[1300px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/getHiredLogo.png"
              alt="GetHired Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0"
            />
            <div
              className="text-[22px] text-[#0066FF] font-bold tracking-tight"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              GetHired
            </div>
          </div>
          <p className="text-[13px] text-gray-400 text-center">
            © 2025 GetHired — DCISM OJT/Practicum Platform. Built for students, by students.
          </p>
          <div className="flex gap-6">
            {(["home", "about", "faqs"] as NavId[]).map((link) => (
              <button
                key={link}
                onClick={() => scrollTo(link)}
                className="text-[13px] text-gray-400 hover:text-[#0073ff] transition-colors capitalize"
              >
                {link === "faqs" ? "FAQs" : link.charAt(0).toUpperCase() + link.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}

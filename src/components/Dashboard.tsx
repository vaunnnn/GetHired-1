"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "./SessionProvider";
import CompanyCard from "./CompanyCard";
import InterviewWorkspace from "./InterviewWorkspace";
import type { InterviewCategory } from "@/lib/interviews";
import type { CompanyListing } from "@gethired/contracts";

import { apiClient } from "@/lib/api-client";
import { companyView, type Company } from "@/lib/companies";
import { COMPANY_NICHES, COMPANY_SPECIALIZATIONS, type Company as CompanyDto, type Bookmark } from "@gethired/contracts";
import CompanyResults, { useCompanyPage } from "./CompanyResults";

type DashView = "home" | "explore" | "interview";

interface ProfileData {
  name: string;
  studentId: string;
  course: string;
  email: string;
  yearLevel: string;
}

/* ═══════════════════════════════ ICON SYSTEM ════════════════════════ */
const ico = (d: string, size = 17) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const HomeIcon     = () => ico("M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5zM9 21V12h6v9");
const SearchIcon   = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
const InterviewIcon = () => ico("M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4");
const ChevronLeft  = () => ico("M15 19l-7-7 7-7", 16);
const XIcon        = () => ico("M18 6L6 18M6 6l12 12", 18);
const LogOutIcon   = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);
const LocationIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const BookmarkIcon = ({ filled, size = 15 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
  </svg>
);
const BuildingIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M3 7l9-4 9 4M4 21V7m16 14V7M9 21v-4h6v4M9 11h.01M12 11h.01M15 11h.01M9 15h.01M15 15h.01" />
  </svg>
);
const MicIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z" /><path d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8" />
  </svg>
);
const GlobeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);
const MailIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" /><path d="M22 6l-10 7L2 6" />
  </svg>
);
const PhoneIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.06 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
  </svg>
);
const ClockIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);
const LightbulbIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.62-1.4 4.91-3.5 6.2V17a1 1 0 01-1 1H9.5a1 1 0 01-1-1v-1.8A7 7 0 0112 2z" />
  </svg>
);
const BotIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M12 11V7M8 7h8M9 15h.01M15 15h.01" />
    <path d="M12 3a2 2 0 100 4 2 2 0 000-4z" />
  </svg>
);

const FilterIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
);
function CompanyModal({
  company,
  onClose,
  onToggleSave,
  onPractice,
}: {
  company: Company;
  onClose: () => void;
  onToggleSave: (id: string, saved: boolean) => void;
  onPractice: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[40px] w-full max-w-[660px] overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="relative h-[200px] bg-gray-100 overflow-hidden shrink-0">
          <img src={company.image} alt={company.name} className="w-full h-full object-cover" />
          <button
            onClick={onClose}
            aria-label="Close company details"
            className="absolute top-4 right-4 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-all shadow-sm"
          >
            <XIcon />
          </button>
          <button
            onClick={() => onToggleSave(company.id, company.saved)}
            className={`absolute top-4 left-4 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all shadow-sm ${
              company.saved ? "bg-[#0073ff] text-white" : "bg-white/90 text-gray-600 hover:bg-white"
            }`}
          >
            <BookmarkIcon filled={company.saved} />
            {company.saved ? "Saved" : "Save"}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-7">
            {/* Badges */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <span className="text-[11px] bg-[#dfe9ff] text-[#0073ff] px-3 py-1 rounded-full font-semibold">
                {company.industry}
              </span>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
                {company.type}
              </span>
            </div>

            {/* Name */}
            <h2
              className="text-[26px] text-[#232323] leading-tight mb-2"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {company.name}
            </h2>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-gray-400 text-[13px] mb-5">
              <LocationIcon />
              {company.location}
            </div>

            <div className="h-px bg-gray-100 mb-5" />

            {/* Description */}
            <p className="text-[14px] text-gray-500 leading-relaxed mb-5">
              {company.description}
            </p>

            {/* Specializations */}
            <div className="mb-6">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
                Specializations
              </div>
              <div className="flex flex-wrap gap-2">
                {company.specializations.map((s) => (
                  <span key={s} className="text-[12px] text-[#0073ff] bg-[#dfe9ff] px-3 py-1.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="h-px bg-gray-100 mb-5" />

            {/* Contact & Hours */}
            <div className="mb-6">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Contact & Opening Hours
              </div>
              <div className="flex flex-col gap-2.5">

                {/* Hours */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-[16px] px-4 py-3">
                  <span className="text-gray-400 shrink-0"><ClockIcon size={15} /></span>
                  <span className="text-[13px] text-gray-600">{company.hours}</span>
                </div>

                {/* Website */}
                <a
                  href={company.website || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-gray-50 rounded-[16px] px-4 py-3 hover:bg-[#dfe9ff] transition-colors group"
                >
                  <span className="text-gray-400 group-hover:text-[#0073ff] shrink-0 transition-colors">
                    <GlobeIcon size={15} />
                  </span>
                  <span className="text-[13px] text-gray-600 group-hover:text-[#0073ff] transition-colors">
                    {company.website}
                  </span>
                  <span className="ml-auto text-[11px] text-gray-300 group-hover:text-[#0073ff] transition-colors">↗</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:${company.email}`}
                  className="flex items-center gap-3 bg-gray-50 rounded-[16px] px-4 py-3 hover:bg-[#dfe9ff] transition-colors group"
                >
                  <span className="text-gray-400 group-hover:text-[#0073ff] shrink-0 transition-colors">
                    <MailIcon size={15} />
                  </span>
                  <span className="text-[13px] text-gray-600 group-hover:text-[#0073ff] transition-colors">
                    {company.email}
                  </span>
                </a>

                {/* Phone */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-[16px] px-4 py-3">
                  <span className="text-gray-400 shrink-0"><PhoneIcon size={15} /></span>
                  <span className="text-[13px] text-gray-600">{company.phone}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => onToggleSave(company.id, company.saved)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold border transition-all ${
                  company.saved
                    ? "border-[#0073ff] text-[#0073ff] bg-[#dfe9ff]"
                    : "border-gray-200 text-gray-500 hover:border-[#0073ff] hover:text-[#0073ff]"
                }`}
              >
                <BookmarkIcon filled={company.saved} />
                {company.saved ? "Unsave" : "Save Company"}
              </button>
              <button
                onClick={onPractice}
                className="flex-1 bg-[#4869ff] text-white text-[14px] font-semibold py-3 rounded-full hover:bg-[#3a55e8] transition-all"
              >
                Practice Interview →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ PROFILE MODAL ══════════════════════ */
function ProfileModal({
  profile,
  onClose,
}: {
  profile: ProfileData;
  onClose: () => void;
}) {
  const fields = [
    { label: "Full Name", value: profile.name },
    { label: "Student ID", value: profile.studentId },
    { label: "Course", value: profile.course },
    { label: "Email", value: profile.email },
    { label: "Year Level", value: profile.yearLevel },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[36px] w-full max-w-[460px] p-7 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[22px] font-bold text-[#0F172A]" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Student Profile
            </h2>
            <p className="text-[12.5px] text-slate-400 mt-0.5">
              Official DCISM Student Record
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-[#0066FF] rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white text-[28px] font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
              {profile.name.split(" ").map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-semibold text-[#0F172A]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {label}
                </label>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1 select-none">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Read-only
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={value}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-[20px] px-4.5 py-3 text-[14px] text-slate-800 outline-none cursor-not-allowed select-text font-medium"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-[12px] text-blue-700 leading-relaxed">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            These fields are linked to your official student registration and cannot be modified. For corrections, please contact the DCISM department coordinator.
          </span>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#0066FF] hover:bg-[#0052cc] text-white text-[14px] font-semibold py-3 rounded-full transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ HOME VIEW ══════════════════════════ */
function HomeView({
  totalSaved,
  totalCompanies,
  companies,
  onToggleSave,
  onViewMore,
}: {
  companies: Company[];
  totalSaved?: number;
  totalCompanies: number;
  onToggleSave: (id: string, saved: boolean) => void;
  onViewMore: (c: Company) => void;
}) {
  const { user } = useSession();
  const saved = companies.filter((c) => c.saved);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[#302929] text-[48px] leading-tight tracking-[-1px]" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Welcome, {user.student?.firstName || user.displayName}!
        </h1>
        <p className="text-gray-400 text-[14px] mt-1">
          {saved.length > 0
            ? `You have ${saved.length} saved ${saved.length === 1 ? "company" : "companies"}.`
            : "You haven't saved any companies yet. Head to Explore to get started."}
        </p>
      </div>

      {/* Quick stats — always first */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-8 sm:mb-10">
        {[
          { label: "Industry Partners",    value: totalCompanies,           Icon: <BuildingIcon size={20} /> },
          { label: "Saved Companies",      value: totalSaved ?? saved.length,               Icon: <BookmarkIcon filled={true} size={20} /> },
          { label: "Interview Practice", value: "Explore", Icon: <MicIcon size={20} /> },
        ].map((s) => (
          <div key={s.label} className="bg-[#dfe9ff] rounded-[22px] p-5 flex items-center gap-4">
            <span className="text-[#0073ff]">{s.Icon}</span>
            <div>
              <div className="text-[26px] text-[#0073ff] leading-none" style={{ fontFamily: "'DM Serif Display', serif" }}>
                {s.value}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {saved.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[16px] font-semibold text-[#302929]">Saved Companies</h2>
              <span className="text-[12px] font-semibold text-[#0066FF] bg-[#dfe9ff] px-2.5 py-0.5 rounded-full">
                {saved.length}
              </span>
            </div>
            {saved.length > 3 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  aria-label="Scroll left"
                  title="Scroll left"
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-[#0066FF] hover:border-[#0066FF] flex items-center justify-center transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  aria-label="Scroll right"
                  title="Scroll right"
                  className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-[#0066FF] hover:border-[#0066FF] flex items-center justify-center transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Horizontally scrollable saved companies: minimum 3 in display on desktop */}
          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-5 pb-5 pt-1 snap-x snap-mandatory scroll-smooth"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#cbd5e1 transparent",
            }}
          >
            {saved.map((c) => (
              <div
                key={c.id}
                className="w-[85%] sm:w-[calc((100%-20px)/2)] lg:w-[calc((100%-40px)/3)] shrink-0 min-w-[280px] snap-start flex flex-col"
              >
                <CompanyCard company={c} onToggleSave={onToggleSave} onViewMore={onViewMore} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-gray-300 flex flex-col items-center gap-3">
          <BookmarkIcon filled={false} size={40} />
          <p className="text-[15px]">No saved companies yet.</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ TECH NICHES ════════════════════════ */
const NICHES = Object.keys(COMPANY_NICHES).map(label => ({ label }));

/* ═══════════════════════════════ FILTER MODAL ═══════════════════════ */
interface ActiveFilters { specializations: string[]; }

function FilterModal({
  companies,
  filters,
  onApply,
  onClose,
}: {
  companies: Company[];
  filters: ActiveFilters;
  onApply: (f: ActiveFilters) => void;
  onClose: () => void;
}) {
  const allSpecs = COMPANY_SPECIALIZATIONS;
  const [draft, setDraft] = useState<ActiveFilters>({ ...filters, specializations: [...filters.specializations] });

  const toggleSpec = (s: string) =>
    setDraft((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(s)
        ? prev.specializations.filter((x) => x !== s)
        : [...prev.specializations, s],
    }));

  const clear = () => setDraft({ specializations: [] });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[36px] w-full max-w-[520px] p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[20px] text-[#302929]" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Filter Companies
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all">
            <XIcon />
          </button>
        </div>

        {/* Specializations */}
        <div className="mb-7">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Specialization
          </div>
          <div className="flex flex-wrap gap-2">
            {allSpecs.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpec(s)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                  draft.specializations.includes(s)
                    ? "bg-[#0073ff] text-white border-[#0073ff]"
                    : "border-gray-200 text-gray-500 hover:border-[#0073ff] hover:text-[#0073ff]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={clear}
            className="flex-1 border border-gray-200 text-gray-500 text-[13px] py-3 rounded-full hover:border-gray-300 transition-all"
          >
            Clear All
          </button>
          <button
            onClick={() => { onApply(draft); onClose(); }}
            className="flex-1 bg-[#0073ff] text-white text-[13px] font-semibold py-3 rounded-full hover:bg-[#0060dd] transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════ EXPLORE VIEW ═══════════════════════ */
function ExploreView({
  savedOverrides,
  enabled,
  revision,
  onRefresh,
  onBookmarkSnapshot,
  onToggleSave,
  onViewMore,
}: {
  savedOverrides: Readonly<Record<string, boolean>>;
  enabled: boolean;
  revision: number;
  onRefresh: () => void;
  onBookmarkSnapshot: (rows: CompanyListing[]) => void;
  onToggleSave: (id: string, saved: boolean) => void;
  onViewMore: (c: Company) => void;
}) {
  const [search, setSearch]           = useState("");
  const [activeNiche, setActiveNiche] = useState("All");
  const [filterOpen, setFilterOpen]   = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ specializations: [] });

  const filterCount = activeFilters.specializations.length;

  const query = new URLSearchParams({ q: search, niche: activeNiche });
  activeFilters.specializations.forEach(spec => query.append("specialization", spec));
  const results = useCompanyPage<CompanyListing>("/api/companies", query.toString(), revision, enabled);
  const knownBookmarks = results.data.every(c => typeof c.bookmarked === "boolean");
  const filtered = knownBookmarks ? results.data.map(c => companyView(c, savedOverrides[c.id] ?? c.bookmarked)) : [];
  useEffect(() => { if (knownBookmarks) onBookmarkSnapshot(results.data); }, [results.data, knownBookmarks, onBookmarkSnapshot]);

  const clearAll = () => { setSearch(""); setActiveNiche("All"); setActiveFilters({ specializations: [] }); };

  return (
    <div>
      {/* Search bar + Filter button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 bg-white rounded-[45px] shadow-sm border border-gray-100 px-5 sm:px-6 py-3 sm:py-3.5 flex items-center gap-3">
          <span className="text-gray-300 shrink-0"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search companies, specializations, or locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none text-[13.5px] sm:text-[14px] text-gray-600 placeholder-gray-300 min-w-0"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500 text-xl leading-none cursor-pointer">×</button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          className={`relative flex items-center justify-center gap-2 px-5 py-3 sm:py-0 rounded-[45px] border font-medium text-[13px] transition-all shadow-sm shrink-0 cursor-pointer ${
            filterCount > 0
              ? "bg-[#0073ff] text-white border-[#0073ff]"
              : "bg-white text-gray-500 border-gray-100 hover:border-[#0073ff] hover:text-[#0073ff]"
          }`}
        >
          <FilterIcon size={14} />
          <span>Filter</span>
          {filterCount > 0 && (
            <span className="bg-white text-[#0073ff] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Tech niche nav — horizontal scroll */}
      <div
        className="flex gap-2 mb-5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {NICHES.map(({ label }) => (
          <button
            key={label}
            onClick={() => setActiveNiche(label)}
            className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-medium transition-all border ${
              activeNiche === label
                ? "bg-[#302929] text-white border-[#302929]"
                : "bg-white text-gray-500 border-gray-100 hover:border-[#0073ff] hover:text-[#0073ff]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Result count + clear */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-gray-300">{results.meta.total} {results.meta.total === 1 ? "company" : "companies"} found</p>
        {(search || activeNiche !== "All" || filterCount > 0) && (
          <button onClick={clearAll} className="text-[12px] text-[#0073ff] hover:underline">
            Clear all
          </button>
        )}
      </div>

      <CompanyResults {...results} error={knownBookmarks ? results.error : "Company information is temporarily unavailable. Please refresh."} reload={onRefresh} />
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <CompanyCard key={c.id} company={c} onToggleSave={onToggleSave} onViewMore={onViewMore} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-300 flex flex-col items-center gap-3">
          <SearchIcon />
          <p className="text-[15px]">{results.loading ? "Loading…" : results.error ? "Companies are unavailable." : "No companies match your filters."}</p>
          <button onClick={clearAll} className="mt-1 text-[13px] text-[#0073ff]">Clear all filters</button>
        </div>
      )}

      {filterOpen && (
        <FilterModal
          companies={filtered}
          filters={activeFilters}
          onApply={setActiveFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════ INTERVIEW PHASE ENGINE ════════════ */


export default function Dashboard() {
  const { user, logout: handleLogout } = useSession();
  const [view, setView] = useState<DashView>("home");
  useEffect(() => {
    try { if (sessionStorage.getItem(`gethired-interview:${user.id}`)) setView("interview"); } catch { /* Resume remains available from history. */ }
  }, [user.id]);
  const [exploreOpened, setExploreOpened] = useState(false);
  const interviewCache = useRef<{ rows: InterviewCategory[]; at: number } | null>(null);
  useEffect(() => { if (view === "explore") setExploreOpened(true); }, [view]);
  const [revision, setRevision] = useState(0);
  const [partnerRevision, setPartnerRevision] = useState(0);
  const bookmarks = useCompanyPage<Bookmark>("/api/me/bookmarks", "", revision, view === "home");
  const partners = useCompanyPage<CompanyDto>("/api/companies", "pageSize=1", partnerRevision, view === "home");
  const [bookmarkError, setBookmarkError] = useState("");
  const savingBookmark = useRef(false);
  const bookmarkVersion = useRef(0);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});
  const companies = bookmarks.data.map(b => companyView(b.company, savedOverrides[b.companyId] ?? true));
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const onBookmarkSnapshot = React.useCallback((rows: CompanyListing[]) => {
    setSavedOverrides(previous => {
      if (!rows.some(row => Object.hasOwn(previous, row.id))) return previous;
      const next = { ...previous }; rows.forEach(row => { delete next[row.id]; }); return next;
    });
    setSelectedCompany(previous => {
      const fresh = rows.find(row => row.id === previous?.id);
      return previous && fresh && previous.saved !== fresh.bookmarked ? { ...previous, saved: fresh.bookmarked } : previous;
    });
  }, []);
  const refreshCompanies = () => { setSavedOverrides({}); setRevision(n => n + 1); setPartnerRevision(n => n + 1); };
  useEffect(() => { onBookmarkSnapshot(bookmarks.data.map(row => ({ ...row.company, bookmarked: true }))); }, [bookmarks.data, onBookmarkSnapshot]);
  const [profileOpen, setProfileOpen] = useState(false);
  const profile: ProfileData = {
    name: user.displayName,
    studentId: user.student?.studentNumber ?? "",
    course: user.student?.course ?? "",
    email: user.email,
    yearLevel: user.student?.yearLevel ?? "",
  };

  const toggleSave = async (id: string, saved: boolean) => {
    if (savingBookmark.current) return;
    savingBookmark.current = true;
    setBookmarkError("");
    try {
      await apiClient.mutate(`/api/me/bookmarks/${id}`, saved ? "DELETE" : "PUT", saved ? undefined : {});
      bookmarkVersion.current++;
      setSavedOverrides(previous => ({ ...previous, [id]: !saved }));
      setSelectedCompany(previous => previous?.id === id ? { ...previous, saved: !saved } : previous);
      setRevision(n => n + 1);
    } catch (error) { setBookmarkError(error instanceof Error ? error.message : "Unable to update bookmark."); }
    finally { savingBookmark.current = false; }
  };
  const viewCompany = async (company: Company) => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const version = bookmarkVersion.current;
        const fresh = await apiClient.get<CompanyListing>(`/api/companies/${company.id}`);
        if (version !== bookmarkVersion.current) continue;
        if (typeof fresh.bookmarked !== "boolean") throw new Error("Company information is temporarily unavailable. Please refresh.");
        setSavedOverrides(previous => ({ ...previous, [company.id]: fresh.bookmarked }));
        setSelectedCompany(companyView(fresh, fresh.bookmarked));
        return;
      }
      throw new Error("Your saved companies changed. Please try again.");
    }
    catch (error) { setBookmarkError(error instanceof Error ? error.message : "Company unavailable."); }
  };

  const navItems: { id: DashView; label: string; Icon: () => React.ReactElement }[] = [
    { id: "home",      label: "Home",      Icon: HomeIcon },
    { id: "explore",   label: "Explore",   Icon: SearchIcon },
    { id: "interview", label: "Interview", Icon: InterviewIcon },
  ];

  return (
    <div className="h-screen flex bg-[#f5f7ff] overflow-hidden" style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* ═══ Desktop Sidebar ═══ */}
      <div
        className="hidden md:flex p-3 shrink-0 flex-col"
        style={{ transition: "width 260ms cubic-bezier(.4,0,.2,1)", width: collapsed ? 88 : 258 }}
      >
        <aside className={`bg-white rounded-[36px] flex flex-col py-6 overflow-hidden h-full shadow-sm border border-gray-100 ${collapsed ? "px-2.5" : ""}`}>

          {/* Logo — click to collapse */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`mb-8 transition-all hover:opacity-85 cursor-pointer flex items-center ${
              collapsed ? "px-0 justify-center w-full" : "px-5 gap-2.5 text-left"
            }`}
          >
            {collapsed ? (
              <img
                src="/getHiredLogo.png"
                alt="GetHired Logo"
                className="w-11 h-11 object-contain shrink-0"
              />
            ) : (
              <>
                <img
                  src="/getHiredLogo.png"
                  alt="GetHired Logo"
                  className="w-10 h-10 object-contain shrink-0"
                />
                <div className="text-[23px] font-bold tracking-tight text-[#0066FF]" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  GetHired
                </div>
              </>
            )}
          </button>

          {/* Nav */}
          <nav className={`flex flex-col gap-1.5 flex-1 ${collapsed ? "px-0" : "px-2"}`}>
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 py-3 rounded-[24px] text-[14px] font-medium transition-all ${
                  collapsed ? "justify-center px-0 w-full" : "px-4"
                } ${
                  view === id
                    ? "bg-[#0073ff] text-white shadow-sm"
                    : "text-gray-500 hover:text-[#0073ff] hover:bg-[#dfe9ff]"
                }`}
              >
                <Icon />
                {!collapsed && <span>{label}</span>}
              </button>
            ))}
          </nav>

          {/* Log out — centered */}
          <div className={collapsed ? "px-0 flex justify-center" : "px-2 flex justify-center"}>
            <button
              onClick={handleLogout}
              title={collapsed ? "Log out" : undefined}
              className="flex items-center justify-center gap-2.5 py-3 rounded-[24px] text-[14px] font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all w-full cursor-pointer active:scale-98"
            >
              <LogOutIcon />
              {!collapsed && <span>Log out</span>}
            </button>
          </div>
        </aside>
      </div>

      {/* ═══ Main ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 sm:px-7 pt-4 sm:pt-5 pb-3 shrink-0">
          {/* Mobile brand header */}
          <div className="flex items-center gap-2 md:hidden">
            <img
              src="/getHiredLogo.png"
              alt="GetHired Logo"
              className="w-8 h-8 object-contain shrink-0"
            />
            <span className="text-[20px] font-bold text-[#0066FF]" style={{ fontFamily: "'DM Serif Display', serif" }}>
              GetHired
            </span>
          </div>

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 sm:gap-3 bg-white rounded-[40px] pl-1.5 pr-3.5 sm:pr-4 py-1.5 shadow-sm border border-gray-100 hover:border-[#b8d0ff] transition-all ml-auto cursor-pointer"
          >
            <div className="w-[38px] sm:w-[42px] h-[38px] sm:h-[42px] bg-[#5462ff] rounded-full flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white text-[12px] sm:text-[13px] font-bold tracking-wide leading-none">
                {profile.name.split(" ").map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="text-left hidden sm:block leading-snug whitespace-nowrap">
              <div className="text-[13px] font-semibold text-[#302929] leading-tight">{profile.name}</div>
              <div className="text-[11px] text-gray-400 leading-tight">{profile.course.replace("BS ", "")}</div>
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-7 pb-24 md:pb-7">
          {bookmarkError && <p role="alert" className="text-red-600 py-3">{bookmarkError}</p>}
          {view === "home" && <CompanyResults {...bookmarks} reload={refreshCompanies} />}
          {view === "home" && !bookmarks.error && <HomeView totalCompanies={partners.meta.total} totalSaved={bookmarks.meta.total} companies={companies} onToggleSave={toggleSave} onViewMore={viewCompany} />}
          {(view === "explore" || exploreOpened) && <div hidden={view !== "explore"}><ExploreView enabled={view === "explore"} savedOverrides={savedOverrides} revision={revision} onRefresh={refreshCompanies} onBookmarkSnapshot={onBookmarkSnapshot} onToggleSave={toggleSave} onViewMore={viewCompany} /></div>}
          {view === "interview" && <InterviewWorkspace cache={interviewCache} />}
        </div>
      </div>

      {/* ═══ Mobile Bottom Navigation Bar ═══ */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-[11px] font-medium transition-all ${
              view === id
                ? "text-[#0073ff] font-semibold"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div className={`p-1 rounded-xl transition-all ${view === id ? "bg-[#0073ff]/10 text-[#0073ff]" : ""}`}>
              <Icon />
            </div>
            <span>{label}</span>
          </button>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-[11px] font-medium text-slate-400 hover:text-red-500 transition-all cursor-pointer"
        >
          <div className="p-1">
            <LogOutIcon />
          </div>
          <span>Logout</span>
        </button>
      </nav>

      {selectedCompany && (
        <CompanyModal
          company={{ ...selectedCompany, saved: savedOverrides[selectedCompany.id] ?? selectedCompany.saved }}
          onClose={() => setSelectedCompany(null)}
          onToggleSave={toggleSave}
          onPractice={() => { setSelectedCompany(null); setView("interview"); }}
        />
      )}

      {profileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}

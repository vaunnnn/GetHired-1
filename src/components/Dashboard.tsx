"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "./SessionProvider";
import CompanyCard from "./CompanyCard";
import CategoryCard, { CategoryIcon } from "./CategoryCard";
import {
  interviewCategories,
  interviewQuestions,
  codingChallenges,
  InterviewQuestion,
  getCategoryPipeline,
  CODING_IDS,
  NON_TECHNICAL_IDS,
} from "../data";

import { apiClient } from "@/lib/api-client";
import { companyView, type Company } from "@/lib/companies";
import { COMPANY_NICHES, COMPANY_SPECIALIZATIONS, type Company as CompanyDto, type Bookmark } from "@gethired/contracts";
import CompanyResults, { useCompanyPage } from "./CompanyResults";
import CompareModal from "./CompareModal";

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
  isComparing = false,
  onToggleCompare,
}: {
  company: Company;
  onClose: () => void;
  onToggleSave: (id: string) => void;
  onPractice: () => void;
  isComparing?: boolean;
  onToggleCompare?: (c: Company) => void;
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
            className="absolute top-4 right-4 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-all shadow-sm"
          >
            <XIcon />
          </button>
          <button
            onClick={() => onToggleSave(company.id)}
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
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              <button
                type="button"
                onClick={() => onToggleSave(company.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold border transition-all cursor-pointer ${
                  company.saved
                    ? "border-[#0073ff] text-[#0073ff] bg-[#dfe9ff]"
                    : "border-gray-200 text-gray-500 hover:border-[#0073ff] hover:text-[#0073ff]"
                }`}
              >
                <BookmarkIcon filled={company.saved} />
                {company.saved ? "Unsave" : "Save Company"}
              </button>
              {onToggleCompare && (
                <button
                  type="button"
                  onClick={() => onToggleCompare(company)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold border transition-all cursor-pointer ${
                    isComparing
                      ? "border-[#0073ff] text-[#0073ff] bg-[#dfe9ff]"
                      : "border-gray-200 text-gray-500 hover:border-[#0073ff] hover:text-[#0073ff]"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                      isComparing ? "bg-[#0073ff] border-[#0073ff] text-white" : "border-gray-300 bg-white"
                    }`}
                  >
                    {isComparing && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span>{isComparing ? "Comparing" : "Compare"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onPractice}
                className="flex-1 bg-[#4869ff] text-white text-[14px] font-semibold py-3 px-5 rounded-full hover:bg-[#3a55e8] transition-all cursor-pointer text-center"
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
  compareIds,
  onToggleCompare,
}: {
  companies: Company[];
  totalSaved?: number;
  totalCompanies: number;
  onToggleSave: (id: string) => void;
  onViewMore: (c: Company) => void;
  compareIds?: ReadonlySet<string>;
  onToggleCompare?: (c: Company) => void;
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
          { label: "Interview Categories", value: interviewCategories.length, Icon: <MicIcon size={20} /> },
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
                <CompanyCard
                  company={c}
                  onToggleSave={onToggleSave}
                  onViewMore={onViewMore}
                  isComparing={compareIds?.has(c.id)}
                  onToggleCompare={onToggleCompare}
                />
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
  savedIds,
  onToggleSave,
  onViewMore,
  compareIds,
  onToggleCompare,
}: {
  savedIds: ReadonlySet<string>;
  onToggleSave: (id: string) => void;
  onViewMore: (c: Company) => void;
  compareIds?: ReadonlySet<string>;
  onToggleCompare?: (c: Company) => void;
}) {
  const [search, setSearch]           = useState("");
  const [activeNiche, setActiveNiche] = useState("All");
  const [filterOpen, setFilterOpen]   = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ specializations: [] });

  const filterCount = activeFilters.specializations.length;

  const query = new URLSearchParams({ q: search, niche: activeNiche });
  activeFilters.specializations.forEach(spec => query.append("specialization", spec));
  const results = useCompanyPage<CompanyDto>("/api/companies", query.toString());
  const filtered = results.data.map(c => companyView(c, savedIds.has(c.id)));

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

      <CompanyResults {...results} />
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              onToggleSave={onToggleSave}
              onViewMore={onViewMore}
              isComparing={compareIds?.has(c.id)}
              onToggleCompare={onToggleCompare}
            />
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


interface InterviewPhaseData {
  id: string;
  label: string;
  shortLabel: string;
  questions: InterviewQuestion[];
}

const YOUR_QUESTIONS_Q: InterviewQuestion = {
  question: "That wraps up our questions for you. The floor is yours — do you have any questions for us about the role, the team, the company culture, or day-to-day life as an intern here?",
  type: "Candidate Questions",
  hint: "Prepare 2–3 thoughtful questions. Strong examples: 'What does the onboarding process look like for OJT interns?', 'What tech stack will I be working with?', 'What does growth look like from the intern role?'",
  feedback: "The best candidates ask specific, researched questions that show genuine curiosity. Asking about team culture, tech stack, mentorship, or what a typical week looks like signals enthusiasm. Vague questions ('Is the work hard?') or asking about compensation in an OJT context signals a lack of preparation. Even 'I've done my research and feel well-informed, but I'd love to know what you enjoy most about working here' is a strong closer.",
};

function makeIntroQ(catName: string): InterviewQuestion {
  return {
    question: `Before we dive in, please introduce yourself — your name, degree and year, any relevant projects or experience you're proud of, and what specifically drew you to ${catName} as your practicum focus.`,
    type: "Introduction",
    hint: "Keep it to about 90 seconds. Structure: who you are → your academic background → one standout project or skill → why this field genuinely interests you. End with energy, not a trailing 'that's about it.'",
    feedback: "A strong introduction is structured, confident, and personal. It covers: name and course (brief), one concrete project or achievement (not a list), and a genuine reason for interest in the field (not 'it pays well'). The best intros end by connecting past experience to what they hope to do at the company. Interviewers remember candidates who sound like themselves — not like they're reading a resume.",
  };
}

function makeSituationalFallback(catName: string): InterviewQuestion {
  return {
    question: `Tell me about a time you had to solve a difficult problem in a ${catName} context — whether in a class project, personal project, or any tech-related experience. Walk me through the situation, what you did, and what you learned.`,
    type: "Behavioral",
    hint: "Use STAR: Situation → Task → Action → Result. Be specific — a real example is always stronger than a hypothetical. Focus on YOUR actions, not the team's.",
    feedback: "Strong answers name a specific problem (not 'we had issues with our project') and walk through what the candidate personally did — not what 'we' did. The Action portion should be detailed: what did you research, try, build, fix? The Result should be concrete (what actually happened) and followed by a genuine lesson. Vague answers like 'I worked hard and we fixed it' reveal a lack of reflection.",
  };
}

function buildPhases(catId: string, catName: string): InterviewPhaseData[] {
  const all  = interviewQuestions[catId] ?? [];
  const techQ = all.filter((q) => q.type === "Technical");
  const behQ  = all.filter((q) => ["Behavioral","Situational","Motivational"].includes(q.type));

  const phases: InterviewPhaseData[] = [
    {
      id: "intro",
      label: "Introduction",
      shortLabel: "Intro",
      questions: [makeIntroQ(catName)],
    },
    {
      id: "situational",
      label: "Situational",
      shortLabel: "Situational",
      questions: behQ.length > 0 ? [behQ[0]] : [makeSituationalFallback(catName)],
    },
  ];

  if (NON_TECHNICAL_IDS.has(catId)) {
    // Non-technical categories (BPO, Behavioral/HR) focus on customer/behavioral competencies without technical/coding
    const remainingBeh = behQ.slice(1);
    phases.push({
      id: "behavioral",
      label: "Behavioral / Interpersonal",
      shortLabel: "Behavioral",
      questions: remainingBeh.length > 0 ? remainingBeh : (all.length > 1 ? all.slice(1, 3) : [makeSituationalFallback(catName)]),
    });
  } else {
    // Technical categories include technical domain questions
    phases.push({
      id: "technical",
      label: "Technical",
      shortLabel: "Technical",
      questions: techQ.length > 0 ? techQ.slice(0, 2) : all.slice(0, 2),
    });

    // Only categories requiring software coding or query challenges have the coding phase
    const challenge = codingChallenges[catId];
    if (CODING_IDS.has(catId) && challenge) {
      phases.push({ id: "coding", label: "Coding / Practical", shortLabel: "Coding", questions: [challenge] });
    }
  }

  phases.push({ id: "your-questions", label: "Your Questions", shortLabel: "Q&A", questions: [YOUR_QUESTIONS_Q] });
  return phases;
}

/* phase-stepper icons */
const PhaseIntroIcon  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
const PhaseSitIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
const PhaseBehIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const PhaseTechIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const PhaseCodeIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M7 9l3 3-3 3M13 12h4"/></svg>;
const PhaseQAIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>;

function phaseIcon(id: string) {
  if (id === "intro")          return <PhaseIntroIcon />;
  if (id === "situational")    return <PhaseSitIcon />;
  if (id === "behavioral")     return <PhaseBehIcon />;
  if (id === "technical")      return <PhaseTechIcon />;
  if (id === "coding")         return <PhaseCodeIcon />;
  return <PhaseQAIcon />;
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    "Technical": "bg-[#dfe9ff] text-[#0073ff]",
    "Behavioral": "bg-[#fef3c7] text-[#d97706]",
    "Situational": "bg-[#fee2e2] text-[#dc2626]",
    "Introduction": "bg-[#f0fdf4] text-[#059669]",
    "Coding": "bg-[#ede9fe] text-[#7c3aed]",
    "Design Challenge": "bg-[#fce7f3] text-[#be185d]",
    "Candidate Questions": "bg-[#f0f9ff] text-[#0369a1]",
  };
  return map[type] ?? "bg-gray-100 text-gray-500";
}

/* ═══════════════════════════════ INTERVIEW VIEW ═════════════════════ */
interface ResultEntry { phase: string; question: string; answer: string; score: number; feedback: string; }

function InterviewView() {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [phases, setPhases]               = useState<InterviewPhaseData[]>([]);
  const [phaseIdx, setPhaseIdx]           = useState(0);
  const [qIdx, setQIdx]                   = useState(0);
  const [answer, setAnswer]               = useState("");
  const [showFeedback, setShowFeedback]   = useState(false);
  const [results, setResults]             = useState<ResultEntry[]>([]);
  const [done, setDone]                   = useState(false);

  const category = interviewCategories.find((c) => c.id === selectedCatId);
  const currentPhase = phases[phaseIdx];
  const currentQ     = currentPhase?.questions[qIdx];

  const totalPhases   = phases.length;
  const completedPhases = done ? totalPhases : phaseIdx;

  const randomScore = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  const startInterview = (catId: string) => {
    const cat = interviewCategories.find((c) => c.id === catId)!;
    setSelectedCatId(catId);
    setPhases(buildPhases(catId, cat.name));
    setPhaseIdx(0); setQIdx(0); setAnswer(""); setShowFeedback(false); setResults([]); setDone(false);
  };

  const reset = () => { setSelectedCatId(null); setPhases([]); setPhaseIdx(0); setQIdx(0); setAnswer(""); setShowFeedback(false); setResults([]); setDone(false); };

  const submitAnswer = () => {
    const isQAPhase = currentPhase.id === "your-questions";
    const minScore  = isQAPhase ? 75 : currentPhase.id === "intro" ? 78 : 68;
    const maxScore  = isQAPhase ? 92 : 96;
    const score = randomScore(minScore, maxScore);
    setResults((prev) => [...prev, {
      phase: currentPhase.label,
      question: currentQ.question,
      answer,
      score,
      feedback: currentQ.feedback,
    }]);
    setShowFeedback(true);
  };

  const advance = () => {
    const questionsInPhase = currentPhase.questions.length;
    if (qIdx + 1 < questionsInPhase) {
      setQIdx((i) => i + 1); setAnswer(""); setShowFeedback(false);
    } else if (phaseIdx + 1 < phases.length) {
      setPhaseIdx((i) => i + 1); setQIdx(0); setAnswer(""); setShowFeedback(false);
    } else {
      setDone(true);
    }
  };

  /* ── Category selector ── */
  if (!selectedCatId) {
    return (
      <div>
        <h1 className="text-[#302929] text-[38px] tracking-[-1px] mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Mock Interview Practice
        </h1>
        <p className="text-gray-400 text-[14px] mb-6">Select a category to begin a structured interview. AI evaluates every response.</p>
        
        {/* How the interview works — placed first */}
        <div className="mb-7 bg-[#dfe9ff] rounded-[28px] p-6">
          <h3 className="text-[16px] text-[#302929] font-semibold mb-3">How the interview works</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Introduction", detail: "Tell us about yourself and your background." },
              { label: "Situational", detail: "Behavioral questions using the STAR method." },
              { label: "Technical / Behavioral", detail: "Domain skills or interpersonal competency." },
              { label: "Coding / Practical", detail: "Live coding or queries for software & data tracks." },
              { label: "Your Questions", detail: "Ask the interviewer — demonstrates curiosity." },
            ].map((t) => (
              <div key={t.label} className="bg-white rounded-[20px] p-4 shadow-xs">
                <div className="font-semibold text-[12px] text-[#302929] mb-1">{t.label}</div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{t.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {interviewCategories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              pipeline={getCategoryPipeline(cat.id)}
              onSelect={() => startInterview(cat.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Results screen ── */
  if (done) {
    const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    return (
      <div>
        <button onClick={reset} className="flex items-center gap-2 text-gray-400 hover:text-[#0073ff] text-[13px] transition-colors mb-6">
          <ChevronLeft /> Back to categories
        </button>

        {/* Overall score banner */}
        <div className="bg-[#4869ff] rounded-[32px] p-7 flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shrink-0 shadow-lg">
            <span className="text-[#4869ff] text-[28px] font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>{avg}</span>
          </div>
          <div>
            <div className="text-white/60 text-[11px] uppercase tracking-widest mb-1">Overall Score</div>
            <div className="text-white text-[24px] font-semibold" style={{ fontFamily: "'DM Serif Display', serif" }}>
              {avg >= 90 ? "Outstanding Interview!" : avg >= 80 ? "Strong Performance." : avg >= 70 ? "Good Effort — Keep Practicing." : "Room to Grow. Keep at it."}
            </div>
            <div className="text-white/60 text-[13px] mt-1">
              {category?.name} · {results.length} questions evaluated by AI
            </div>
          </div>
        </div>

        {/* Phase breakdown */}
        <h2 className="text-[16px] font-semibold text-[#302929] mb-4">Phase Breakdown</h2>
        <div className="space-y-3 mb-6">
          {results.map((r, i) => (
            <div key={i} className="bg-white rounded-[24px] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{r.phase}</span>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-bold shadow-sm ${
                  r.score >= 88 ? "bg-[#d1fae5] text-[#059669]" : r.score >= 75 ? "bg-[#dfe9ff] text-[#0073ff]" : "bg-[#fee2e2] text-[#dc2626]"
                }`} style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {r.score}
                </div>
              </div>
              <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 mb-2">{r.question}</p>
              <div className="bg-gray-50 rounded-[14px] p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[#0073ff]"><BotIcon size={13} /></span>
                  <span className="text-[11px] font-semibold text-[#302929]">AI Feedback</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{r.feedback}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => startInterview(selectedCatId!)} className="flex-1 bg-[#0073ff] text-white text-[13px] font-semibold py-3.5 rounded-full hover:bg-[#0060dd] transition-all">
            Retry This Category
          </button>
          <button onClick={reset} className="flex-1 border border-gray-200 text-gray-500 text-[13px] py-3.5 rounded-full hover:border-[#0073ff] hover:text-[#0073ff] transition-all">
            Try Another Category
          </button>
        </div>
      </div>
    );
  }

  /* ── Active interview ── */
  const isQAPhase = currentPhase.id === "your-questions";
  const isCodingPhase = currentPhase.id === "coding";
  const minLen = isQAPhase ? 1 : 20;

  return (
    <div>
      <button onClick={reset} className="flex items-center gap-2 text-gray-400 hover:text-[#0073ff] text-[13px] transition-colors mb-5">
        <ChevronLeft /> Back to categories
      </button>

      {/* Category + phase label */}
      <div className="flex items-center gap-3 mb-5">
        <span style={{ color: category?.color }}><CategoryIcon id={selectedCatId!} size={22} /></span>
        <span className="text-[#302929] text-[20px]" style={{ fontFamily: "'DM Serif Display', serif" }}>{category?.name}</span>
        <span className="ml-auto text-[12px] text-gray-400">{phaseIdx + 1} of {totalPhases} phases</span>
      </div>

      {/* Phase stepper */}
      <div className="flex items-center gap-0 mb-6 bg-white rounded-[20px] p-2 shadow-sm">
        {phases.map((ph, i) => {
          const isComplete = i < phaseIdx || done;
          const isCurrent  = i === phaseIdx && !done;
          return (
            <React.Fragment key={ph.id}>
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] transition-all ${
                isCurrent  ? "bg-[#0073ff] text-white" :
                isComplete ? "text-[#059669]" : "text-gray-300"
              }`}>
                <span>{phaseIcon(ph.id)}</span>
                <span className="text-[11px] font-semibold whitespace-nowrap hidden sm:block">{ph.shortLabel}</span>
              </div>
              {i < phases.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${i < phaseIdx ? "bg-[#059669]" : "bg-gray-100"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Phase header */}
      <div className="mb-4">
        <div className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">
          Phase {phaseIdx + 1}: {currentPhase.label}
          {currentPhase.questions.length > 1 && ` · Question ${qIdx + 1} of ${currentPhase.questions.length}`}
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-[28px] p-7 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${typeBadge(currentQ.type)}`}>
            {currentQ.type}
          </span>
        </div>
        <p className="text-[16px] text-[#302929] leading-relaxed font-medium mb-5 whitespace-pre-line">{currentQ.question}</p>
        <div className="bg-[#dfe9ff] rounded-[14px] p-4 flex gap-3 items-start">
          <span className="text-[#0073ff] shrink-0 mt-0.5"><LightbulbIcon size={15} /></span>
          <p className="text-[13px] text-[#0073ff] leading-relaxed">{currentQ.hint}</p>
        </div>
      </div>

      {/* Answer / feedback */}
      {!showFeedback ? (
        <div className="bg-white rounded-[28px] p-6 shadow-sm">
          <label className="block text-[13px] font-semibold text-[#302929] mb-3">
            {isQAPhase ? "Your Questions for the Interviewer" : isCodingPhase ? "Your Solution" : "Your Answer"}
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              isQAPhase ? "Type your questions here, or 'No questions at this time.'"
              : isCodingPhase ? "Write your code or solution here..."
              : "Type your answer here. Use the STAR method for behavioral questions..."
            }
            rows={isCodingPhase ? 10 : 7}
            className="w-full outline-none text-[14px] text-gray-600 leading-relaxed resize-none placeholder-gray-200"
            style={{ fontFamily: isCodingPhase ? "'Courier New', monospace" : "'Poppins', sans-serif" }}
          />
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
            <span className="text-[11px] text-gray-300">{answer.length} characters</span>
            <button
              onClick={submitAnswer}
              disabled={answer.trim().length < minLen}
              className="bg-[#0073ff] text-white text-[13px] font-semibold px-7 py-2.5 rounded-full hover:bg-[#0060dd] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit for AI Evaluation
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Score */}
          {results[results.length - 1] && (() => {
            const latest = results[results.length - 1];
            return (
              <div className="bg-[#4869ff] rounded-[28px] p-6 flex items-center gap-5">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shrink-0 shadow">
                  <span className="text-[#4869ff] text-[20px] font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>{latest.score}</span>
                </div>
                <div>
                  <div className="text-white font-semibold text-[15px]">
                    {latest.score >= 90 ? "Excellent response!" : latest.score >= 80 ? "Strong answer." : latest.score >= 70 ? "Good effort." : "Keep practicing."}
                  </div>
                  <div className="text-white/60 text-[12px] mt-0.5">{currentPhase.label} · AI evaluation complete</div>
                </div>
              </div>
            );
          })()}

          {/* Your answer */}
          <div className="bg-white rounded-[28px] p-6 shadow-sm">
            <div className="text-[11px] font-semibold text-gray-300 mb-3 uppercase tracking-wide">Your Answer</div>
            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{answer}</p>
          </div>

          {/* AI feedback */}
          <div className="bg-white rounded-[28px] p-6 shadow-sm border-l-4 border-[#0073ff]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#0073ff]"><BotIcon size={15} /></span>
              <span className="text-[13px] font-semibold text-[#302929]">AI Feedback</span>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed">{currentQ.feedback}</p>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={advance}
              className="flex-1 bg-[#0073ff] text-white text-[13px] font-semibold py-3.5 rounded-full hover:bg-[#0060dd] transition-all"
            >
              {phaseIdx + 1 === totalPhases && qIdx + 1 === currentPhase.questions.length
                ? "See Results →"
                : qIdx + 1 < currentPhase.questions.length
                  ? `Next Question →`
                  : `Next Phase: ${phases[phaseIdx + 1]?.shortLabel} →`}
            </button>
            <button
              onClick={() => { setAnswer(""); setShowFeedback(false); setResults((r) => r.slice(0, -1)); }}
              className="border border-gray-200 text-gray-500 text-[13px] px-6 py-3.5 rounded-full hover:border-[#0073ff] hover:text-[#0073ff] transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ DASHBOARD SHELL ════════════════════ */
export default function Dashboard() {
  const { user, logout: handleLogout } = useSession();
  const [view, setView] = useState<DashView>("home");
  const [revision, setRevision] = useState(0);
  const bookmarks = useCompanyPage<Bookmark>("/api/me/bookmarks", "", revision);
  const partners = useCompanyPage<CompanyDto>("/api/companies", "pageSize=1", revision);
  const companies = bookmarks.data.map(b => companyView(b.company, true));
  const [bookmarkError, setBookmarkError] = useState("");
  const savingBookmark = useRef(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    // Read all bookmark IDs so Explore never mistakes an off-page save for an unsaved company.
    void (async () => {
      const ids = new Set<string>();
      for (let page = 1; ; page++) {
        const result = await apiClient.list<Bookmark>(`/api/me/bookmarks?page=${page}&pageSize=100`);
        result.data.forEach(b => ids.add(b.companyId));
        if (page * result.meta!.pageSize >= result.meta!.total) break;
      }
      if (!cancelled) setSavedIds(ids);
    })().catch(error => { if (!cancelled) setBookmarkError(error.message); });
    return () => { cancelled = true; };
  }, [revision]);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Company Comparison State
  const [compareCompanies, setCompareCompanies] = useState<Map<string, Company>>(new Map());
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareNotification, setCompareNotification] = useState<string | null>(null);

  const compareIds = new Set(compareCompanies.keys());

  useEffect(() => {
    if (!compareNotification) return;
    const timer = setTimeout(() => setCompareNotification(null), 3500);
    return () => clearTimeout(timer);
  }, [compareNotification]);

  const toggleCompare = (company: Company) => {
    setCompareCompanies((prev) => {
      const next = new Map(prev);
      if (next.has(company.id)) {
        next.delete(company.id);
      } else {
        if (next.size >= 4) {
          setCompareNotification("You can compare up to 4 companies at a time.");
          return prev;
        }
        next.set(company.id, company);
      }
      return next;
    });
  };

  const removeCompare = (id: string) => {
    setCompareCompanies((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const clearCompare = () => {
    setCompareCompanies(new Map());
    setCompareModalOpen(false);
  };
  const profile: ProfileData = {
    name: user.displayName,
    studentId: user.student?.studentNumber ?? "",
    course: user.student?.course ?? "",
    email: user.email,
    yearLevel: user.student?.yearLevel ?? "",
  };

  const toggleSave = async (id: string) => {
    if (savingBookmark.current) return;
    savingBookmark.current = true;
    setBookmarkError("");
    const saved = savedIds.has(id);
    try {
      await apiClient.mutate(`/api/me/bookmarks/${id}`, saved ? "DELETE" : "PUT", saved ? undefined : {});
      setSavedIds(previous => { const next = new Set(previous); saved ? next.delete(id) : next.add(id); return next; });
      setRevision(n => n + 1);
    } catch (error) { setBookmarkError(error instanceof Error ? error.message : "Unable to update bookmark."); }
    finally { savingBookmark.current = false; }
  };
  const viewCompany = async (company: Company) => {
    try { setSelectedCompany(companyView(await apiClient.get<CompanyDto>(`/api/companies/${company.id}`), savedIds.has(company.id))); }
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
                src="/getHiredLogo.PNG"
                alt="GetHired Logo"
                className="w-11 h-11 object-contain shrink-0"
              />
            ) : (
              <>
                <img
                  src="/getHiredLogo.PNG"
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
              src="/getHiredLogo.PNG"
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
          {view === "home" && <CompanyResults {...bookmarks} reload={() => { bookmarks.reload(); setRevision(n => n + 1); }} />}
          {view === "home" && !bookmarks.loading && !bookmarks.error && (
            <HomeView
              totalCompanies={partners.meta.total}
              totalSaved={bookmarks.meta.total}
              companies={companies}
              onToggleSave={toggleSave}
              onViewMore={viewCompany}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
          )}
          {view === "explore" && (
            <ExploreView
              savedIds={savedIds}
              onToggleSave={toggleSave}
              onViewMore={viewCompany}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
          )}
          {view === "interview" && <InterviewView />}
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
          company={{ ...selectedCompany, saved: savedIds.has(selectedCompany.id) }}
          onClose={() => setSelectedCompany(null)}
          onToggleSave={toggleSave}
          onPractice={() => { setSelectedCompany(null); setView("interview"); }}
          isComparing={compareIds.has(selectedCompany.id)}
          onToggleCompare={toggleCompare}
        />
      )}

      {profileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {/* ═══ Floating Comparison Dock ═══ */}
      {compareCompanies.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] sm:max-w-2xl w-auto animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-full px-3.5 sm:px-5 py-2.5 flex items-center gap-2.5 sm:gap-3.5">
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[180px] sm:max-w-[280px] py-0.5">
              {Array.from(compareCompanies.values()).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/60 rounded-full pl-1.5 pr-2 py-1 shrink-0"
                >
                  <img src={c.image} alt={c.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                  <span className="text-[11.5px] font-medium text-slate-700 max-w-[65px] sm:max-w-[85px] truncate">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => removeCompare(c.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors ml-0.5 cursor-pointer text-[12px] leading-none"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <span className="text-[11px] font-semibold text-slate-400 shrink-0 hidden sm:inline">
              {compareCompanies.size}/4
            </span>

            <div className="h-4 w-px bg-slate-200 shrink-0" />

            <button
              type="button"
              onClick={clearCompare}
              className="text-[12px] text-slate-400 hover:text-slate-600 font-medium hover:underline shrink-0 cursor-pointer"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="bg-[#0073ff] hover:bg-[#005cd6] text-white text-[12.5px] font-semibold px-4 py-2 rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
            >
              <span>Compare</span>
              <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                {compareCompanies.size}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ Compare Notification Toast ═══ */}
      {compareNotification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#302929] text-white text-[13px] px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <span>{compareNotification}</span>
          <button
            type="button"
            onClick={() => setCompareNotification(null)}
            className="text-white/70 hover:text-white cursor-pointer ml-1 text-sm leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* ═══ Comparison Modal ═══ */}
      {compareModalOpen && (
        <CompareModal
          companies={Array.from(compareCompanies.values())}
          savedIds={savedIds}
          onClose={() => setCompareModalOpen(false)}
          onRemove={removeCompare}
          onClear={clearCompare}
          onToggleSave={toggleSave}
          onViewDetails={(c) => {
            setCompareModalOpen(false);
            setSelectedCompany(companyView(c, savedIds.has(c.id)));
          }}
          onPracticeInterview={() => {
            setCompareModalOpen(false);
            setView("interview");
          }}
        />
      )}
    </div>
  );
}

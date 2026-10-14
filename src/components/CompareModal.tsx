"use client";

import React from "react";
import type { Company } from "@/lib/companies";

export interface CompareModalProps {
  companies: Company[];
  savedIds: ReadonlySet<string>;
  onClose: () => void;
  onRemove: (companyId: string) => void;
  onClear: () => void;
  onToggleSave: (companyId: string) => void;
  onViewDetails: (company: Company) => void;
  onPracticeInterview?: (company: Company) => void;
}

const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const LocationIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-gray-400">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const BookmarkIcon = ({ filled = false, size = 13 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const MailIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 9.81 19.79 19.79 0 0 1 .06 1.18 2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L6.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 14.92v2z" />
  </svg>
);

const MicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
    <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" />
  </svg>
);

const CompareIcon = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="7" height="16" rx="2" />
    <rect x="14" y="4" width="7" height="16" rx="2" />
    <line x1="7.5" y1="8" x2="6.5" y2="8" />
    <line x1="7.5" y1="12" x2="6.5" y2="12" />
    <line x1="18.5" y1="8" x2="17.5" y2="8" />
    <line x1="18.5" y1="12" x2="17.5" y2="12" />
  </svg>
);

export default function CompareModal({
  companies,
  savedIds,
  onClose,
  onRemove,
  onClear,
  onToggleSave,
  onViewDetails,
  onPracticeInterview,
}: CompareModalProps) {
  const hasMinimumSelection = companies.length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
    >
      <div
        className="bg-white rounded-[32px] sm:rounded-[40px] w-full max-w-6xl shadow-2xl flex flex-col overflow-hidden border border-slate-100"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div className="pr-4">
            <div className="flex items-center gap-2.5">
              <h2
                id="compare-modal-title"
                className="text-[22px] sm:text-[26px] text-[#232323] leading-tight font-bold"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Compare Companies
              </h2>
              {hasMinimumSelection && (
                <span className="text-[11px] font-semibold text-[#0073ff] bg-[#dfe9ff] px-2.5 py-0.5 rounded-full">
                  {companies.length} of 4
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Side-by-side comparison to help you choose the best practicum partner.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {companies.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-[12px] font-medium text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-50 cursor-pointer"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-all cursor-pointer"
              aria-label="Close compare modal"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!hasMinimumSelection ? (
          /* Empty or Insufficient Selection State */
          <div className="p-10 sm:p-14 text-center flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 rounded-full bg-[#dfe9ff] text-[#0073ff] flex items-center justify-center mb-4 shadow-xs">
              <CompareIcon size={30} />
            </div>
            <h3
              className="text-[22px] font-bold text-[#232323] mb-2"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              {companies.length === 0 ? "No companies selected" : "Select at least 2 companies"}
            </h3>
            <p className="text-[14px] text-gray-400 max-w-md leading-relaxed mb-6">
              {companies.length === 0
                ? "You haven't selected any companies yet. Click the 'Compare' checkbox on company cards to compare up to 4 companies side-by-side."
                : "You currently have 1 company selected. Please select at least one more company to compare their slots, specializations, and requirements."}
            </p>

            {companies.length === 1 && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 mb-6 max-w-sm w-full">
                <img
                  src={companies[0].image}
                  alt={companies[0].name}
                  className="w-9 h-9 rounded-xl object-cover"
                />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 truncate">{companies[0].name}</p>
                  <p className="text-[11px] text-slate-400">{companies[0].industry}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(companies[0].id)}
                  className="text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                  title="Remove company"
                >
                  <XIcon size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="bg-[#0073ff] hover:bg-[#005cd6] text-white text-[14px] font-semibold px-6 py-3 rounded-full shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              Browse Companies
            </button>
          </div>
        ) : (
          /* Side-by-side Comparison Grid */
          <div className="overflow-x-auto overflow-y-auto flex-1 p-5 sm:p-7">
            <div
              className="grid gap-4 sm:gap-6 pb-2"
              style={{
                gridTemplateColumns: `repeat(${companies.length}, minmax(260px, 1fr))`,
                minWidth: `${companies.length * 270}px`,
              }}
            >
              {companies.map((company) => {
                const isSaved = savedIds.has(company.id);
                return (
                  <div
                    key={company.id}
                    className="bg-slate-50/70 border border-slate-200/80 rounded-[28px] p-5 flex flex-col justify-between transition-all hover:border-blue-200 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Company Image & Actions */}
                      <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-slate-200 shrink-0">
                        <img
                          src={company.image}
                          alt={company.name}
                          className="w-full h-full object-cover"
                        />
                        {/* Bookmark Button */}
                        <button
                          type="button"
                          onClick={() => onToggleSave(company.id)}
                          className={`absolute top-2.5 left-2.5 px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all cursor-pointer ${
                            isSaved
                              ? "bg-[#0073ff] text-white"
                              : "bg-white/95 text-gray-600 hover:bg-white"
                          }`}
                          title={isSaved ? "Saved" : "Save Company"}
                        >
                          <BookmarkIcon filled={isSaved} size={12} />
                          <span>{isSaved ? "Saved" : "Save"}</span>
                        </button>

                        {/* Remove from Compare */}
                        <button
                          type="button"
                          onClick={() => onRemove(company.id)}
                          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-gray-500 hover:text-red-500 flex items-center justify-center shadow-sm transition-colors cursor-pointer"
                          title="Remove from comparison"
                          aria-label={`Remove ${company.name} from comparison`}
                        >
                          <XIcon size={14} />
                        </button>
                      </div>

                      {/* Header Info */}
                      <div>
                        <h3
                          className="text-[18px] text-[#232323] font-bold leading-tight line-clamp-1 mb-1.5"
                          style={{ fontFamily: "'DM Serif Text', serif" }}
                        >
                          {company.name}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] bg-[#dfe9ff] text-[#0073ff] px-2.5 py-0.5 rounded-full font-semibold">
                            {company.industry}
                          </span>
                          <span className="text-[10px] bg-white border border-slate-200 text-gray-600 px-2 py-0.5 rounded-full">
                            {company.type}
                          </span>
                        </div>
                      </div>

                      {/* Attribute: OJT Slots */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-100 flex flex-col gap-1">
                        <span className="text-[10.5px] uppercase font-bold tracking-wider text-gray-400">
                          OJT Capacity
                        </span>
                        <div>
                          {company.slots > 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {company.slots} Slots Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[12px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              Open for inquiry
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attribute: Location & Hours */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-100 flex flex-col gap-2">
                        <span className="text-[10.5px] uppercase font-bold tracking-wider text-gray-400">
                          Work Setup & Location
                        </span>
                        <div className="flex items-start gap-1.5 text-[12px] text-gray-600">
                          <LocationIcon />
                          <span className="line-clamp-2">{company.location}</span>
                        </div>
                        {company.hours && (
                          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 pt-1 border-t border-slate-100">
                            <ClockIcon />
                            <span className="truncate">{company.hours}</span>
                          </div>
                        )}
                      </div>

                      {/* Attribute: Specializations */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-100 flex flex-col gap-2">
                        <span className="text-[10.5px] uppercase font-bold tracking-wider text-gray-400">
                          Specializations
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {company.specializations.map((spec: string) => (
                            <span
                              key={spec}
                              className="text-[10px] text-[#0073ff] bg-[#dfe9ff] px-2 py-0.5 rounded-full font-medium"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Attribute: Overview / Description */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-100 flex flex-col gap-1">
                        <span className="text-[10.5px] uppercase font-bold tracking-wider text-gray-400">
                          Overview
                        </span>
                        <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-3">
                          {company.description}
                        </p>
                      </div>

                      {/* Attribute: Contact Details */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-100 flex flex-col gap-2 text-[12px]">
                        <span className="text-[10.5px] uppercase font-bold tracking-wider text-gray-400">
                          Contact
                        </span>
                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-blue-600 hover:underline truncate"
                          >
                            <GlobeIcon />
                            <span className="truncate">{company.website.replace(/^https?:\/\//, "")}</span>
                          </a>
                        )}
                        {company.email && (
                          <a
                            href={`mailto:${company.email}`}
                            className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 truncate"
                          >
                            <MailIcon />
                            <span className="truncate">{company.email}</span>
                          </a>
                        )}
                        {company.phone && (
                          <div className="flex items-center gap-1.5 text-gray-500 truncate">
                            <PhoneIcon />
                            <span className="truncate">{company.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onViewDetails(company)}
                        className="w-full text-center py-2.5 rounded-full text-[12.5px] font-semibold bg-white border border-slate-200 text-gray-700 hover:bg-slate-100 hover:text-[#0073ff] transition-all cursor-pointer"
                      >
                        View Full Details →
                      </button>
                      {onPracticeInterview && (
                        <button
                          type="button"
                          onClick={() => onPracticeInterview(company)}
                          className="w-full text-center py-2.5 rounded-full text-[12.5px] font-semibold bg-[#0073ff] text-white hover:bg-[#005cd6] shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MicIcon />
                          <span>Practice Interview</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

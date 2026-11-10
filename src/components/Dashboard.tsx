"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { useSession } from "./SessionProvider"
import CompanyCard from "./CompanyCard"
import InterviewWorkspace from "./InterviewWorkspace"
import type { InterviewCategory } from "@/lib/interviews"
import type { CompanyListing } from "@gethired/contracts"

import { apiClient } from "@/lib/api-client"
import { companyView, type Company } from "@/lib/companies"
import {
  COMPANY_NICHES,
  COMPANY_SPECIALIZATIONS,
  type Company as CompanyDto,
  type Bookmark,
} from "@gethired/contracts"
import CompanyResults, { useCompanyPage } from "./CompanyResults"
import CompareModal from "./CompareModal"

type DashView = "home" | "explore" | "interview"

interface ProfileData {
  name: string
  studentId: string
  course: string
  email: string
  yearLevel: string
}
const ico = (d: string, size = 17) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
)

const HomeIcon = () =>
  ico("M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5zM9 21V12h6v9")
const SearchIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)
const InterviewIcon = () =>
  ico(
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4",
  )
const ChevronLeft = () => ico("M15 19l-7-7 7-7", 16)
const XIcon = () => ico("M18 6L6 18M6 6l12 12", 18)
const LogOutIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
)
const LocationIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)
const BookmarkIcon = ({
  filled,
  size = 15,
}: {
  filled: boolean
  size?: number
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
  </svg>
)
const BuildingIcon = ({ size = 17 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 21h18M3 7l9-4 9 4M4 21V7m16 14V7M9 21v-4h6v4M9 11h.01M12 11h.01M15 11h.01M9 15h.01M15 15h.01" />
  </svg>
)
const MicIcon = ({ size = 17 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z" />
    <path d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8" />
  </svg>
)
const GlobeIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
)
const MailIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
    <path d="M22 6l-10 7L2 6" />
  </svg>
)
const PhoneIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.06 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z" />
  </svg>
)
const ClockIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
)
const LightbulbIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.62-1.4 4.91-3.5 6.2V17a1 1 0 01-1 1H9.5a1 1 0 01-1-1v-1.8A7 7 0 0112 2z" />
  </svg>
)
const BotIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M12 11V7M8 7h8M9 15h.01M15 15h.01" />
    <path d="M12 3a2 2 0 100 4 2 2 0 000-4z" />
  </svg>
)

const FilterIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
)
const VerifiedIcon = ({ size = 9 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function CompanyModal({
  company,
  onClose,
  onToggleSave,
  onPractice,
  isComparing = false,
  onToggleCompare,
}: {
  company: Company
  onClose: () => void
  onToggleSave: (id: string, saved: boolean) => void
  onPractice: () => void
  isComparing?: boolean
  onToggleCompare?: (c: Company) => void
}) {
  const isVerified = company.verified !== false
  const verifiedDate = company.verified_on || "Accredited"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] sm:rounded-[36px] w-full max-w-[620px] shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Row */}
        <div className="p-6 sm:p-7 pb-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          {/* Verification Badge */}
          <div className="flex items-center gap-2">
            {isVerified ? (
              <div
                className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 pl-1.5 pr-2.5 py-0.5 rounded-full text-[11px]"
                title={`Verified Partner · ${verifiedDate}`}
              >
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <VerifiedIcon size={8} />
                </span>
                <span className="font-semibold text-emerald-800">Verified</span>
                <span className="text-emerald-600/75 text-[10.5px]">· {verifiedDate}</span>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                title="Unverified Company"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>Unverified</span>
              </div>
            )}
          </div>

          {/* Action buttons (Bookmark & Close) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleSave(company.id, company.saved)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all border cursor-pointer ${
                company.saved
                  ? "bg-[#0066FF] text-white border-[#0066FF]"
                  : "bg-slate-50 text-slate-600 hover:text-[#0066FF] border-slate-200/80 hover:bg-blue-50"
              }`}
            >
              <BookmarkIcon filled={company.saved} size={13} />
              <span>{company.saved ? "Saved" : "Save"}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close company details"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-6 sm:p-7 space-y-5">
          {/* Company Title & Categories */}
          <div>
            <div className="flex gap-2 mb-2 flex-wrap items-center">
              {/* Primary Category Pill */}
              <span className="text-[11.5px] bg-[#EEF5FF] text-[#0066FF] border border-[#0066FF]/20 px-3 py-0.5 rounded-full font-semibold">
                {company.industry}
              </span>
              {/* Type Pill */}
              <span className="text-[11.5px] bg-slate-100 text-slate-600 border border-slate-200/80 px-3 py-0.5 rounded-full font-medium">
                {company.type}
              </span>
            </div>

            <h2 className="text-[24px] sm:text-[26px] font-bold text-slate-800 leading-tight mb-2">
              {company.name}
            </h2>

            <div className="flex items-center gap-2 text-slate-500 text-[13px]">
              <LocationIcon />
              <span>{company.location}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              About the Partner
            </h3>
            <p className="text-[13.5px] text-slate-600 leading-relaxed">
              {company.description}
            </p>
          </div>

          {/* Specializations / Tech Niches */}
          {company.specializations && company.specializations.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Specializations & Tech Stack
              </h3>
              <div className="flex flex-wrap gap-2">
                {company.specializations.map((s) => (
                  <span
                    key={s}
                    className="text-[11.5px] text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-full font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact Details & Operating Hours */}
          <div>
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Contact & Operating Hours
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Operating Hours */}
              <div className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl px-3.5 py-2.5">
                <span className="text-slate-400 shrink-0">
                  <ClockIcon size={14} />
                </span>
                <span className="text-[12.5px] text-slate-600 truncate">
                  {company.hours}
                </span>
              </div>

              {/* Website */}
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl px-3.5 py-2.5 hover:bg-blue-50/70 hover:border-blue-200/60 transition-colors group"
                >
                  <span className="text-slate-400 group-hover:text-[#0066FF] shrink-0 transition-colors">
                    <GlobeIcon size={14} />
                  </span>
                  <span className="text-[12.5px] text-slate-600 group-hover:text-[#0066FF] truncate">
                    {company.website.replace(/^https?:\/\//, "")}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400 group-hover:text-[#0066FF] shrink-0">
                    ↗
                  </span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl px-3.5 py-2.5 opacity-60">
                  <GlobeIcon size={14} />
                  <span className="text-[12.5px] text-slate-500">No website listed</span>
                </div>
              )}

              {/* Email */}
              {company.email ? (
                <a
                  href={`mailto:${company.email}`}
                  className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl px-3.5 py-2.5 hover:bg-blue-50/70 hover:border-blue-200/60 transition-colors group"
                >
                  <span className="text-slate-400 group-hover:text-[#0066FF] shrink-0 transition-colors">
                    <MailIcon size={14} />
                  </span>
                  <span className="text-[12.5px] text-slate-600 group-hover:text-[#0066FF] truncate">
                    {company.email}
                  </span>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl px-3.5 py-2.5 opacity-60">
                  <MailIcon size={14} />
                  <span className="text-[12.5px] text-slate-500">No email listed</span>
                </div>
              )}

              {/* Phone */}
              <div className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-100 rounded-2xl px-3.5 py-2.5">
                <span className="text-slate-400 shrink-0">
                  <PhoneIcon size={14} />
                </span>
                <span className="text-[12.5px] text-slate-600 truncate">
                  {company.phone || "No phone listed"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onToggleSave(company.id, company.saved)}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold border transition-all cursor-pointer ${
              company.saved
                ? "border-[#0066FF] text-[#0066FF] bg-[#EEF5FF]"
                : "border-slate-200 bg-white text-slate-600 hover:border-[#0066FF] hover:text-[#0066FF]"
            }`}
          >
            <BookmarkIcon filled={company.saved} size={15} />
            <span>{company.saved ? "Saved" : "Save Partner"}</span>
          </button>
          {onToggleCompare && (
            <button
              type="button"
              onClick={() => onToggleCompare(company)}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold border transition-all cursor-pointer ${
                isComparing
                  ? "border-[#0066FF] text-[#0066FF] bg-[#EEF5FF]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#0066FF] hover:text-[#0066FF]"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                  isComparing ? "bg-[#0066FF] border-[#0066FF] text-white" : "border-slate-300 bg-white"
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
            className="flex-1 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13.5px] font-semibold py-2.5 rounded-full shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-98 text-center"
          >
            Practice Interview →
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileModal({
  profile,
  onClose,
}: {
  profile: ProfileData
  onClose: () => void
}) {
  const fields = [
    { label: "Full Name", value: profile.name },
    { label: "Student ID", value: profile.studentId },
    { label: "Course", value: profile.course },
    { label: "Email", value: profile.email },
    { label: "Year Level", value: profile.yearLevel },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[36px] w-full max-w-[460px] p-7 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[22px] font-bold text-slate-800">
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
            <span className="text-white text-[28px] font-bold">
              {profile.name
                .split(" ")
                .map((w) => w.charAt(0))
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="text-[13px] font-semibold text-[#0F172A]"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {label}
                </label>
                <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1 select-none">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            These fields are linked to your official student registration and
            cannot be modified. For corrections, please contact the DCISM
            department coordinator.
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
  )
}
function HomeView({
  totalSaved,
  totalCompanies,
  companies,
  onToggleSave,
  onViewMore,
  onNavigateExplore,
  compareIds,
  onToggleCompare,
}: {
  companies: Company[]
  totalSaved?: number
  totalCompanies: number
  onToggleSave: (id: string, saved: boolean) => void
  onViewMore: (c: Company) => void
  onNavigateExplore?: () => void
  compareIds?: ReadonlySet<string>
  onToggleCompare?: (c: Company) => void
}) {
  const { user } = useSession()
  const saved = companies.filter((c) => c.saved)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current
      const scrollAmount = clientWidth * 0.75
      scrollRef.current.scrollTo({
        left:
          direction === "left"
            ? scrollLeft - scrollAmount
            : scrollLeft + scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-slate-800 text-[28px] sm:text-[34px] font-bold leading-tight tracking-tight">
          Welcome, {user.student?.firstName || user.displayName}!
        </h1>
        <p className="text-slate-400 text-[13.5px] mt-1 font-medium">
          {saved.length > 0
            ? `You have ${saved.length} saved ${
                saved.length === 1 ? "company" : "companies"
              }.`
            : "You haven't saved any companies yet. Head to Explore to get started."}
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 mb-8 sm:mb-10">
        {[
          {
            label: "Industry Partners",
            value: totalCompanies,
            Icon: <BuildingIcon size={20} />,
          },
          {
            label: "Saved Companies",
            value: totalSaved ?? saved.length,
            Icon: <BookmarkIcon filled={true} size={20} />,
          },
          {
            label: "Interview Practice",
            value: "Explore",
            Icon: <MicIcon size={20} />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-center gap-4 shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
              {s.Icon}
            </div>
            <div>
              <div className="text-[24px] font-bold text-slate-800 leading-tight">
                {s.value}
              </div>
              <div className="text-[12px] font-medium text-slate-400 mt-0.5">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {saved.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[16px] font-bold text-slate-800">
                Saved Companies
              </h2>
              <span className="text-[12px] font-semibold text-[#0066FF] bg-[#EEF5FF] border border-[#0066FF]/20 px-2.5 py-0.5 rounded-full">
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
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-[#0066FF] hover:border-[#0066FF] flex items-center justify-center transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  aria-label="Scroll right"
                  title="Scroll right"
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-[#0066FF] hover:border-[#0066FF] flex items-center justify-center transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-95"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>

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
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 sm:p-14 text-center flex flex-col items-center max-w-lg mx-auto shadow-xs my-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mb-3.5 shadow-2xs">
            <BookmarkIcon filled={false} size={24} />
          </div>
          <h3 className="text-[17px] font-bold text-slate-800 mb-1">
            No saved companies yet
          </h3>
          <p className="text-[13px] text-slate-400 max-w-sm mb-5 leading-relaxed">
            Bookmark your favorite accredited industry partners to quickly access their details, specializations, and contact information.
          </p>
          {onNavigateExplore && (
            <button
              type="button"
              onClick={onNavigateExplore}
              className="inline-flex items-center gap-2 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98"
            >
              <span>Explore Partners</span>
              <span className="text-[14px] leading-none">→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
const NICHES = Object.keys(COMPANY_NICHES).map((label) => ({ label }))
interface ActiveFilters {
  specializations: string[]
}

function FilterModal({
  companies,
  filters,
  onApply,
  onClose,
}: {
  companies: Company[]
  filters: ActiveFilters
  onApply: (f: ActiveFilters) => void
  onClose: () => void
}) {
  const allSpecs = COMPANY_SPECIALIZATIONS
  const [draft, setDraft] = useState<ActiveFilters>({
    ...filters,
    specializations: [...filters.specializations],
  })

  const toggleSpec = (s: string) =>
    setDraft((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(s)
        ? prev.specializations.filter((x) => x !== s)
        : [...prev.specializations, s],
    }))

  const clear = () => setDraft({ specializations: [] })

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
        {}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[20px] font-bold text-slate-800">
            Filter Companies
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all"
          >
            <XIcon />
          </button>
        </div>

        {}
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

        {}
        <div className="flex gap-3">
          <button
            onClick={clear}
            className="flex-1 border border-gray-200 text-gray-500 text-[13px] py-3 rounded-full hover:border-gray-300 transition-all"
          >
            Clear All
          </button>
          <button
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className="flex-1 bg-[#0073ff] text-white text-[13px] font-semibold py-3 rounded-full hover:bg-[#0060dd] transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}
function ExploreView({
  savedOverrides,
  enabled,
  revision,
  onRefresh,
  onBookmarkSnapshot,
  onToggleSave,
  onViewMore,
  compareIds,
  onToggleCompare,
}: {
  savedOverrides: Readonly<Record<string, boolean>>
  enabled: boolean
  revision: number
  onRefresh: () => void
  onBookmarkSnapshot: (rows: CompanyListing[]) => void
  onToggleSave: (id: string, saved: boolean) => void
  onViewMore: (c: Company) => void
  compareIds?: ReadonlySet<string>
  onToggleCompare?: (c: Company) => void
}) {
  const [search, setSearch] = useState("")
  const [activeNiche, setActiveNiche] = useState("All")
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    specializations: [],
  })

  const filterCount = activeFilters.specializations.length

  const query = new URLSearchParams({ q: search, niche: activeNiche })
  activeFilters.specializations.forEach((spec) =>
    query.append("specialization", spec),
  )
  const results = useCompanyPage<CompanyListing>(
    "/api/companies",
    query.toString(),
    revision,
    enabled,
  )
  const knownBookmarks = results.data.every(
    (c) => typeof c.bookmarked === "boolean",
  )
  const filtered = knownBookmarks
    ? results.data.map((c) =>
        companyView(c, savedOverrides[c.id] ?? c.bookmarked),
      )
    : []
  useEffect(() => {
    if (knownBookmarks) onBookmarkSnapshot(results.data)
  }, [results.data, knownBookmarks, onBookmarkSnapshot])

  const clearAll = () => {
    setSearch("")
    setActiveNiche("All")
    setActiveFilters({ specializations: [] })
  }

  return (
    <div>
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 bg-white rounded-full shadow-2xs border border-slate-200/90 px-4 sm:px-5 py-2.5 flex items-center gap-3 focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/10 transition-all">
          <span className="text-slate-400 shrink-0">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search companies, specializations, or locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none text-[13.5px] text-slate-700 placeholder-slate-400 min-w-0 bg-transparent font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 sm:py-0 rounded-full border text-[13px] font-semibold transition-all shadow-2xs shrink-0 cursor-pointer ${
            filterCount > 0
              ? "bg-[#EEF5FF] text-[#0066FF] border-[#0066FF]"
              : "bg-white text-slate-700 border-slate-200/90 hover:border-[#0066FF] hover:text-[#0066FF]"
          }`}
        >
          <FilterIcon size={14} />
          <span>Filters</span>
          {filterCount > 0 && (
            <span className="bg-[#0066FF] text-white text-[10.5px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Tech niche nav — horizontal scroll */}
      <div
        className="flex gap-2 mb-4 overflow-x-auto pb-1.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {NICHES.map(({ label }) => {
          const isActive = activeNiche === label
          return (
            <button
              key={label}
              onClick={() => setActiveNiche(label)}
              className={`shrink-0 px-4 py-2 rounded-full text-[12.5px] font-semibold transition-all border cursor-pointer select-none ${
                isActive
                  ? "bg-[#0066FF] text-white border-[#0066FF] shadow-xs"
                  : "bg-white text-slate-700 border-slate-200/80 hover:border-[#0066FF] hover:text-[#0066FF] shadow-2xs"
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {(search || activeNiche !== "All" || filterCount > 0) && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[12px] font-medium text-slate-500">
            Active filters applied
          </span>
          <button
            onClick={clearAll}
            className="text-[12px] font-semibold text-[#0066FF] hover:underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      <CompanyResults
        {...results}
        error={
          knownBookmarks
            ? results.error
            : "Company information is temporarily unavailable. Please refresh."
        }
        reload={onRefresh}
      />
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
        <div className="bg-white border border-slate-200/80 rounded-3xl p-10 sm:p-14 text-center flex flex-col items-center max-w-lg mx-auto shadow-xs my-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0066FF] flex items-center justify-center mb-3.5 shadow-2xs">
            <SearchIcon />
          </div>
          <h3 className="text-[17px] font-bold text-slate-800 mb-1">
            {results.loading ? "Loading partner directory…" : "No matching companies"}
          </h3>
          <p className="text-[13px] text-slate-400 max-w-sm mb-5 leading-relaxed">
            {results.loading
              ? "Fetching accredited industry partners..."
              : results.error
                ? results.error
                : "We couldn't find any accredited partners matching your search or filters."}
          </p>
          {!results.loading && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 bg-[#EEF5FF] hover:bg-[#0066FF] text-[#0066FF] hover:text-white border border-[#0066FF]/20 text-[13px] font-semibold px-4 py-2 rounded-full transition-all cursor-pointer shadow-2xs"
            >
              <span>Clear all filters</span>
            </button>
          )}
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
  )
}

export default function Dashboard() {
  const { user, logout: handleLogout } = useSession()
  const [view, setView] = useState<DashView>("home")
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`gethired-interview:${user.id}`))
        setView("interview")
    } catch {}
  }, [user.id])
  const [exploreOpened, setExploreOpened] = useState(false)
  const interviewCache = useRef<{
    rows: InterviewCategory[]
    at: number
  } | null>(null)
  useEffect(() => {
    if (view === "explore") setExploreOpened(true)
  }, [view])
  const [revision, setRevision] = useState(0)
  const [partnerRevision, setPartnerRevision] = useState(0)
  const bookmarks = useCompanyPage<Bookmark>(
    "/api/me/bookmarks",
    "",
    revision,
    view === "home",
  )
  const partners = useCompanyPage<CompanyDto>(
    "/api/companies",
    "pageSize=1",
    partnerRevision,
    view === "home",
  )
  const [bookmarkError, setBookmarkError] = useState("")
  const savingBookmark = useRef(false)
  const bookmarkVersion = useRef(0)
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>(
    {},
  )
  const [authoritativeBookmarks, setAuthoritativeBookmarks] = useState<
    Record<string, boolean>
  >({})
  const companies = bookmarks.data.map((b) =>
    companyView(b.company, savedOverrides[b.companyId] ?? true),
  )
  const [collapsed, setCollapsed] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const onBookmarkSnapshot = React.useCallback((rows: CompanyListing[]) => {
    setAuthoritativeBookmarks((previous) => {
      let changed = false
      const next = { ...previous }
      for (const row of rows) {
        if (
          typeof row.bookmarked === "boolean" &&
          next[row.id] !== row.bookmarked
        ) {
          next[row.id] = row.bookmarked
          changed = true
        }
      }
      return changed ? next : previous
    })
    setSavedOverrides((previous) => {
      if (!rows.some((row) => Object.hasOwn(previous, row.id))) return previous
      const next = { ...previous }
      rows.forEach((row) => {
        delete next[row.id]
      })
      return next
    })
    setSelectedCompany((previous) => {
      const fresh = rows.find((row) => row.id === previous?.id)
      return previous && fresh && previous.saved !== fresh.bookmarked
        ? { ...previous, saved: fresh.bookmarked }
        : previous
    })
    setCompareCompanies((previous) => {
      let changed = false
      const next = new Map(previous)
      for (const row of rows) {
        if (typeof row.bookmarked === "boolean" && next.has(row.id)) {
          const existing = next.get(row.id)!
          if (existing.saved !== row.bookmarked) {
            next.set(row.id, { ...existing, saved: row.bookmarked })
            changed = true
          }
        }
      }
      return changed ? next : previous
    })
  }, [])
  const refreshCompanies = () => {
    setSavedOverrides({})
    setRevision((n) => n + 1)
    setPartnerRevision((n) => n + 1)
  }
  useEffect(() => {
    onBookmarkSnapshot(
      bookmarks.data.map((row) => ({ ...row.company, bookmarked: true })),
    )
  }, [bookmarks.data, onBookmarkSnapshot])
  const [profileOpen, setProfileOpen] = useState(false)

  // Company Comparison State
  const [compareCompanies, setCompareCompanies] = useState<Map<string, Company>>(
    new Map(),
  )
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [compareNotification, setCompareNotification] = useState<string | null>(
    null,
  )

  const compareIds = new Set(compareCompanies.keys())

  const savedIds = useMemo(() => {
    const set = new Set<string>()
    bookmarks.data.forEach((b) => set.add(b.company.id))
    for (const [id, isSaved] of Object.entries(authoritativeBookmarks)) {
      if (isSaved) set.add(id)
      else set.delete(id)
    }
    compareCompanies.forEach((company, id) => {
      if (
        authoritativeBookmarks[id] === undefined &&
        savedOverrides[id] === undefined
      ) {
        if (company.saved) set.add(id)
        else set.delete(id)
      }
    })
    for (const [id, isSaved] of Object.entries(savedOverrides)) {
      if (isSaved) set.add(id)
      else set.delete(id)
    }
    return set
  }, [bookmarks.data, authoritativeBookmarks, compareCompanies, savedOverrides])

  useEffect(() => {
    if (!compareNotification) return
    const timer = setTimeout(() => setCompareNotification(null), 3500)
    return () => clearTimeout(timer)
  }, [compareNotification])

  const toggleCompare = (company: Company) => {
    setCompareCompanies((prev) => {
      const next = new Map(prev)
      if (next.has(company.id)) {
        next.delete(company.id)
      } else {
        if (next.size >= 4) {
          setCompareNotification("You can compare up to 4 companies at a time.")
          return prev
        }
        const isSaved =
          savedOverrides[company.id] ??
          authoritativeBookmarks[company.id] ??
          company.saved
        next.set(company.id, { ...company, saved: isSaved })
      }
      return next
    })
    setAuthoritativeBookmarks((prev) => {
      const isSaved =
        savedOverrides[company.id] ?? prev[company.id] ?? company.saved
      return prev[company.id] === isSaved
        ? prev
        : { ...prev, [company.id]: isSaved }
    })
  }

  const removeCompare = (id: string) => {
    setCompareCompanies((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  const clearCompare = () => {
    setCompareCompanies(new Map())
    setCompareModalOpen(false)
  }
  const profile: ProfileData = {
    name: user.displayName,
    studentId: user.student?.studentNumber ?? "",
    course: user.student?.course ?? "",
    email: user.email,
    yearLevel: user.student?.yearLevel ?? "",
  }

  const toggleSave = async (id: string, saved: boolean) => {
    if (savingBookmark.current) return
    savingBookmark.current = true
    setBookmarkError("")
    try {
      await apiClient.mutate(
        `/api/me/bookmarks/${id}`,
        saved ? "DELETE" : "PUT",
        saved ? undefined : {},
      )
      bookmarkVersion.current++
      setSavedOverrides((previous) => ({ ...previous, [id]: !saved }))
      setAuthoritativeBookmarks((previous) => ({ ...previous, [id]: !saved }))
      setSelectedCompany((previous) =>
        previous?.id === id ? { ...previous, saved: !saved } : previous,
      )
      setCompareCompanies((previous) => {
        if (!previous.has(id)) return previous
        const next = new Map(previous)
        const existing = next.get(id)!
        next.set(id, { ...existing, saved: !saved })
        return next
      })
      setRevision((n) => n + 1)
    } catch (error) {
      setBookmarkError(
        error instanceof Error ? error.message : "Unable to update bookmark.",
      )
    } finally {
      savingBookmark.current = false
    }
  }
  const viewCompany = async (company: Company) => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const version = bookmarkVersion.current
        const fresh = await apiClient.get<CompanyListing>(
          `/api/companies/${company.id}`,
        )
        if (version !== bookmarkVersion.current) continue
        if (typeof fresh.bookmarked !== "boolean")
          throw new Error(
            "Company information is temporarily unavailable. Please refresh.",
          )
        setSavedOverrides((previous) => ({
          ...previous,
          [company.id]: fresh.bookmarked,
        }))
        setAuthoritativeBookmarks((previous) => ({
          ...previous,
          [company.id]: fresh.bookmarked,
        }))
        setSelectedCompany(companyView(fresh, fresh.bookmarked))
        setCompareCompanies((previous) => {
          if (!previous.has(company.id)) return previous
          const next = new Map(previous)
          const existing = next.get(company.id)!
          if (existing.saved !== fresh.bookmarked) {
            next.set(company.id, { ...existing, saved: fresh.bookmarked })
            return next
          }
          return previous
        })
        return
      }
      throw new Error("Your saved companies changed. Please try again.")
    } catch (error) {
      setBookmarkError(
        error instanceof Error ? error.message : "Company unavailable.",
      )
    }
  }

  const navItems: {
    id: DashView
    label: string
    Icon: () => React.ReactElement
  }[] = [
    { id: "home", label: "Home", Icon: HomeIcon },
    { id: "explore", label: "Explore", Icon: SearchIcon },
    { id: "interview", label: "Interview", Icon: InterviewIcon },
  ]

  return (
    <div
      className="h-screen flex bg-[#f5f7ff] overflow-hidden"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {}
      <div
        className="hidden md:flex p-3 shrink-0 flex-col"
        style={{
          transition: "width 260ms cubic-bezier(.4,0,.2,1)",
          width: collapsed ? 88 : 258,
        }}
      >
        <aside
          className={`bg-white rounded-[36px] flex flex-col py-6 overflow-hidden h-full shadow-sm border border-gray-100 ${
            collapsed ? "px-2.5" : ""
          }`}
        >
          {}
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`mb-8 transition-all hover:opacity-85 cursor-pointer flex items-center ${
              collapsed
                ? "px-0 justify-center w-full"
                : "px-5 gap-2.5 text-left"
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
                <div className="text-[23px] font-bold tracking-tight text-[#0066FF]">
                  GetHired
                </div>
              </>
            )}
          </button>

          {}
          <nav
            className={`flex flex-col gap-1.5 flex-1 ${
              collapsed ? "px-0" : "px-2"
            }`}
          >
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

          {}
          <div
            className={
              collapsed
                ? "px-0 flex justify-center"
                : "px-2 flex justify-center"
            }
          >
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

      {/* ═══ Main Content Area ═══ */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/40">
        {/* Floating Top Header Card */}
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 shrink-0">
          <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 sm:py-4.5 bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 md:hidden shrink-0">
                <img
                  src="/getHiredLogo.png"
                  alt="GetHired Logo"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <h1 className="text-[17px] sm:text-[21px] lg:text-[24px] font-bold text-[#0066FF] tracking-tight truncate">
                {view === "home" && "Dashboard Overview"}
                {view === "explore" && "Explore Industry Partners"}
                {view === "interview" && "Mock Interview Practice"}
              </h1>
            </div>

            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-200/90 rounded-full pl-1.5 pr-3.5 sm:pr-4 py-1.5 shadow-2xs hover:border-[#0066FF] transition-all cursor-pointer"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0066FF] text-white font-bold text-[12px] sm:text-[13px] flex items-center justify-center shrink-0">
                {profile.name
                  .split(" ")
                  .map((w) => w.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="text-left hidden sm:block leading-tight whitespace-nowrap">
                <div className="text-[12.5px] font-semibold text-slate-700">
                  {profile.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {profile.course.replace("BS ", "")}
                </div>
              </div>
            </button>
          </header>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 pb-24 md:pb-8">
          {bookmarkError && (
            <p role="alert" className="text-red-600 py-3">
              {bookmarkError}
            </p>
          )}
          {view === "home" && <CompanyResults {...bookmarks} reload={refreshCompanies} />}
          {view === "home" && !bookmarks.error && (
            <HomeView
              totalCompanies={partners.meta.total}
              totalSaved={bookmarks.meta.total}
              companies={companies}
              onToggleSave={toggleSave}
              onViewMore={viewCompany}
              onNavigateExplore={() => setView("explore")}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
          )}
          {(view === "explore" || exploreOpened) && (
            <div hidden={view !== "explore"}>
              <ExploreView
                enabled={view === "explore"}
                savedOverrides={savedOverrides}
                revision={revision}
                onRefresh={refreshCompanies}
                onBookmarkSnapshot={onBookmarkSnapshot}
                onToggleSave={toggleSave}
                onViewMore={viewCompany}
                compareIds={compareIds}
                onToggleCompare={toggleCompare}
              />
            </div>
          )}
          {view === "interview" && (
            <InterviewWorkspace cache={interviewCache} />
          )}
        </div>
      </div>

      {}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-3 py-1.5 flex items-center justify-around shadow-lg"
      >
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
            <div
              className={`p-1 rounded-xl transition-all ${
                view === id ? "bg-[#0073ff]/10 text-[#0073ff]" : ""
              }`}
            >
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
          company={{
            ...selectedCompany,
            saved: savedOverrides[selectedCompany.id] ?? selectedCompany.saved,
          }}
          onClose={() => setSelectedCompany(null)}
          onToggleSave={toggleSave}
          onPractice={() => {
            setSelectedCompany(null)
            setView("interview")
          }}
          isComparing={compareIds.has(selectedCompany.id)}
          onToggleCompare={toggleCompare}
        />
      )}

      {profileOpen && (
        <ProfileModal profile={profile} onClose={() => setProfileOpen(false)} />
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
          companies={Array.from(compareCompanies.values()).map(c => ({
            ...c,
            saved: savedIds.has(c.id),
          }))}
          savedIds={savedIds}
          onClose={() => setCompareModalOpen(false)}
          onRemove={removeCompare}
          onClear={clearCompare}
          onToggleSave={(id) => void toggleSave(id, savedIds.has(id))}
          onViewDetails={(c) => {
            setCompareModalOpen(false);
            void viewCompany(c);
          }}
          onPracticeInterview={() => {
            setCompareModalOpen(false);
            setView("interview");
          }}
        />
      )}
    </div>
  )
}

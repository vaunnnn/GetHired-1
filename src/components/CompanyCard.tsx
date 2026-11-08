"use client"

import React from "react"
import type { Company } from "@/lib/companies"

export interface CompanyCardProps {
  company: Company
  isAdmin?: boolean
  onToggleSave?: (id: string, saved: boolean) => void
  onViewMore?: (c: Company) => void
  onEdit?: (c: Company) => void
  onDelete?: (id: string) => void
  onDeactivate?: (c: Company) => void
  onReactivate?: (c: Company) => void
}

const PowerIcon = ({ size = 13 }: { size?: number }) => (
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
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
)

const BookmarkIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)

const LocationIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

const EditIcon = ({ size = 13 }: { size?: number }) => (
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const VerifiedIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const GlobeIcon = ({ size = 12 }: { size?: number }) => (
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
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const MailIcon = ({ size = 12 }: { size?: number }) => (
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
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)

const PhoneIcon = ({ size = 12 }: { size?: number }) => (
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
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const ClockIcon = ({ size = 12 }: { size?: number }) => (
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
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

export default function CompanyCard({
  company,
  isAdmin = false,
  onToggleSave,
  onViewMore,
  onEdit,
  onDelete,
  onDeactivate,
  onReactivate,
}: CompanyCardProps) {
  const handleCardClick = () => {
    if (onViewMore) {
      onViewMore(company)
    } else if (isAdmin && onEdit) {
      onEdit(company)
    }
  }

  const isVerified = company.verified !== false
  const verifiedDate = company.verified_on || "Accredited"

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleCardClick()
        }
      }}
      role="button"
      tabIndex={0}
      className={`bg-white rounded-2xl sm:rounded-3xl shadow-xs hover:shadow-md transition-all p-5 sm:p-6 flex flex-col border border-slate-200/80 hover:border-blue-200 h-full group cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] ${
        company.deactivated ? "opacity-75 bg-slate-50/60" : ""
      }`}
    >
      {/* Top Header: Sleek Compact Verified Badge, Deactivated Badge & Actions */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Verification Badge (Verified or Unverified) */}
          {isVerified ? (
            <div
              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/70 pl-1 pr-2 py-0.5 rounded-full text-[10.5px]"
              title={`Verified Partner · ${verifiedDate}`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <VerifiedIcon size={8} />
              </span>
              <span className="font-semibold text-emerald-800">Verified</span>
              <span className="text-emerald-600/75 text-[10px]">· {verifiedDate}</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 border border-slate-200/80 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium"
              title="Unverified Company"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span>Unverified</span>
            </div>
          )}

          {company.deactivated && (
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
              Deactivated
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isAdmin ? (
            company.deactivated ? (
              <button
                type="button"
                onClick={() => onReactivate?.(company)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-full shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Reactivate Company"
              >
                Reactivate
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEdit?.(company)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-[#0066FF] border border-slate-200/70 flex items-center justify-center transition-all cursor-pointer"
                  title="Edit Company"
                >
                  <EditIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeactivate) {
                      onDeactivate(company)
                    } else {
                      onDelete?.(company.id)
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-600 border border-slate-200/70 flex items-center justify-center transition-all cursor-pointer"
                  title="Deactivate Company"
                >
                  <PowerIcon size={13} />
                </button>
              </>
            )
          ) : onToggleSave ? (
            <button
              type="button"
              onClick={() => onToggleSave(company.id, company.saved)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border cursor-pointer ${
                company.saved
                  ? "bg-[#0066FF] text-white border-[#0066FF]"
                  : "bg-slate-50 text-slate-400 hover:text-[#0066FF] border-slate-200/70 hover:bg-blue-50"
              }`}
              title={company.saved ? "Unsave" : "Save Company"}
            >
              <BookmarkIcon filled={company.saved} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Company Name */}
      <div className="mb-2">
        <h3 className="text-[17px] font-bold text-slate-800 group-hover:text-[#0066FF] transition-colors leading-tight">
          {company.name}
        </h3>
      </div>

      {/* Category Tag Hierarchy & Unified System */}
      <div className="mb-3 space-y-1.5">
        {/* Primary Main Category: Prominent Pill Badge */}
        {company.industry && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066FF] text-white shadow-2xs">
              {company.industry}
            </span>
            {company.type && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                {company.type}
              </span>
            )}
          </div>
        )}

        {/* Sub-Categories & Specializations: Clean Subtle Neutral Outline Pills */}
        {company.specializations && company.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {company.specializations.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-[10px] text-slate-600 bg-white border border-slate-200/80 hover:bg-slate-50 px-2 py-0.5 rounded-full font-medium transition-colors"
              >
                {s}
              </span>
            ))}
            {company.specializations.length > 3 && (
              <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 rounded-full font-medium">
                +{company.specializations.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-3 mb-2.5">
        {company.description}
      </p>

      {/* Subtle Divider */}
      <div className="h-px bg-slate-100 my-2" />

      {/* Contact & Hours Details: Location, Phone, Hours, Website, Email */}
      <div className="space-y-1.5 text-[11.5px] text-slate-500 py-1 flex-1">
        {company.location && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0">
              <LocationIcon />
            </span>
            <span className="truncate">{company.location}</span>
          </div>
        )}
        {company.phone && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0">
              <PhoneIcon size={12} />
            </span>
            <span className="truncate">{company.phone}</span>
          </div>
        )}
        {company.hours && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0">
              <ClockIcon size={12} />
            </span>
            <span className="truncate">{company.hours}</span>
          </div>
        )}
        {company.website && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0">
              <GlobeIcon size={12} />
            </span>
            <a
              href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate text-[#0066FF] hover:underline"
            >
              {company.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
        {company.email && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 shrink-0">
              <MailIcon size={12} />
            </span>
            <span className="truncate">{company.email}</span>
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[12px]">
        {isAdmin ? (
          <>
            {company.deactivated ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onReactivate?.(company)
                }}
                className="font-semibold text-emerald-600 hover:underline cursor-pointer"
              >
                Reactivate Company
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(company)
                }}
                className="font-semibold text-[#0066FF] hover:underline cursor-pointer"
              >
                Edit Details →
              </button>
            )}
            {onViewMore && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onViewMore(company)
                }}
                className="text-slate-500 hover:text-[#0066FF] transition-colors cursor-pointer"
              >
                Preview Card
              </button>
            )}
          </>
        ) : (
          <div className="w-full flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onViewMore?.(company)
              }}
              className="text-slate-500 hover:text-[#0066FF] font-medium transition-colors cursor-pointer"
            >
              Know More →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

"use client";

import React from "react";
import type { Company } from "@/lib/companies";

export interface CompanyCardProps {
  company: Company;
  isAdmin?: boolean;
  onToggleSave?: (id: string) => void;
  onViewMore?: (c: Company) => void;
  onEdit?: (c: Company) => void;
  onDelete?: (id: string) => void;
  onDeactivate?: (c: Company) => void;
  onReactivate?: (c: Company) => void;
  isComparing?: boolean;
  onToggleCompare?: (c: Company) => void;
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
);

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
);

const LocationIcon = () => (
  <svg
    width="11"
    height="11"
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
);

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
);

const TrashIcon = ({ size = 13 }: { size?: number }) => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function CompanyCard({
  company,
  isAdmin = false,
  onToggleSave,
  onViewMore,
  onEdit,
  onDelete,
  onDeactivate,
  onReactivate,
  isComparing = false,
  onToggleCompare,
}: CompanyCardProps) {
  const handleCardClick = () => {
    if (onViewMore) {
      onViewMore(company);
    } else if (isAdmin && onEdit) {
      onEdit(company);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={`bg-white rounded-[32px] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col border border-slate-100 hover:border-slate-200/80 h-full group cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF] ${
        company.deactivated ? "opacity-75 bg-slate-50/50" : ""
      }`}
    >
      {/* Card Image Banner */}
      <div className="relative h-[140px] bg-slate-100 overflow-hidden shrink-0">
        {company.image ? (
          <img
            src={company.image}
            alt={company.name}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-slate-300">
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#0066FF]/40">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
            </svg>
          </div>
        )}

        {company.deactivated && (
          <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10.5px] font-bold px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider backdrop-blur-xs">
            Deactivated
          </span>
        )}

        {isAdmin ? (
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {company.deactivated ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReactivate?.(company);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-full shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                title="Reactivate Company"
              >
                Reactivate
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(company);
                  }}
                  className="w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-[#0066FF] shadow-sm flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                  title="Edit Company"
                >
                  <EditIcon size={13} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeactivate) {
                      onDeactivate(company);
                    } else {
                      onDelete?.(company.id);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-700 hover:text-amber-600 shadow-sm flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
                  title="Deactivate Company"
                >
                  <PowerIcon size={13} />
                </button>
              </>
            )}
          </div>
        ) : onToggleSave ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(company.id);
            }}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm cursor-pointer ${
              company.saved
                ? "bg-[#0073ff] text-white"
                : "bg-white text-gray-400 hover:text-[#0073ff]"
            }`}
            title={company.saved ? "Unsave" : "Save Company"}
          >
            <BookmarkIcon filled={company.saved} />
          </button>
        ) : null}
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <div
            className="text-[16px] text-[#232323] leading-tight font-bold"
            style={{ fontFamily: "'DM Serif Text', serif" }}
          >
            {company.name}
          </div>
          {isAdmin && (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0066FF] shrink-0">
              {company.industry}
            </span>
          )}
        </div>

        <div className="h-px bg-black/6 my-3" />

        <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-3 flex-1">
          {company.description}
        </p>

        <div className="mt-3 flex flex-wrap gap-1">
          {company.specializations.slice(0, 2).map((s: string) => (
            <span
              key={s}
              className="text-[10px] text-[#0073ff] bg-[#dfe9ff] px-2 py-0.5 rounded-full font-medium"
            >
              {s}
            </span>
          ))}
          {company.specializations.length > 2 && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">
              +{company.specializations.length - 2}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
            <LocationIcon />
            <span className="truncate">{company.location.split(",")[1]?.trim() ?? company.location}</span>
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          {isAdmin ? (
            <>
              {company.deactivated ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReactivate?.(company);
                  }}
                  className="text-[11.5px] font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  Reactivate Company
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(company);
                  }}
                  className="text-[11.5px] font-semibold text-[#0066FF] hover:underline cursor-pointer"
                >
                  Edit Company →
                </button>
              )}
              {onViewMore && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewMore(company);
                  }}
                  className="text-[11px] text-slate-400 hover:text-[#0066FF] transition-colors cursor-pointer"
                >
                  preview card
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              {onToggleCompare ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCompare(company);
                  }}
                  className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer px-2 py-0.5 rounded-full ${
                    isComparing
                      ? "text-[#0073ff] bg-[#dfe9ff] font-semibold"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                  title={isComparing ? "Remove from comparison" : "Add to comparison"}
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
                  <span>Compare</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewMore?.(company);
                }}
                className="text-[11px] text-gray-400 hover:text-[#0073ff] font-medium transition-colors cursor-pointer"
              >
                know more →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

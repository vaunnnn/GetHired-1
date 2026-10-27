"use client";

import React from "react";
import type { InterviewCategory } from "@/lib/interviews";

export interface CategoryCardProps {
  category: InterviewCategory;
  pipeline?: string;
  questionCount?: number;
  isAdmin?: boolean;
  onSelect?: () => void;
  onEdit?: (cat: InterviewCategory) => void;
  onDelete?: (id: string) => void;
  onDeactivate?: (cat: InterviewCategory) => void;
  onReactivate?: (cat: InterviewCategory) => void;
  onManageQuestions?: (cat: InterviewCategory) => void;
}

const PowerIcon = ({ size = 14 }: { size?: number }) => (
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

/* Category SVG icons */
const WebDevIcon      = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4M7 9l3 3-3 3M13 15h4" /></svg>;
const DataIcon        = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>;
const ShieldIcon      = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
const HeadphonesIcon  = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg>;
const HandshakeIcon   = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>;
const SmartphoneIcon  = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>;
const CloudIcon       = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" /></svg>;
const PenToolIcon     = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>;
const DatabaseIcon    = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>;
const NetworkIcon     = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="6" height="6" rx="1" /><rect x="16" y="2" width="6" height="6" rx="1" /><rect x="9" y="16" width="6" height="6" rx="1" /><path d="M5 8v3a2 2 0 002 2h10a2 2 0 002-2V8M12 13v3" /></svg>;
const FlaskIcon       = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M9 3v7l-4 9a1 1 0 00.9 1.4h12.2a1 1 0 00.9-1.4l-4-9V3" /><path d="M7 16h10" /></svg>;
const GamepadIcon     = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="15" y1="13" x2="15.01" y2="13" strokeWidth="3" /><line x1="18" y1="11" x2="18.01" y2="11" strokeWidth="3" /><rect x="2" y="6" width="20" height="12" rx="6" /></svg>;

/* Default Robot Icon for any newly created categories */
export const BotIcon  = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="3" />
    <circle cx="8.5" cy="16" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="16" r="1.5" fill="currentColor" />
    <path d="M12 11V7" />
    <circle cx="12" cy="5" r="2" />
    <path d="M2 16h1M21 16h1" />
  </svg>
);

export function CategoryIcon({ id, size = 24 }: { id: string; size?: number }) {
  if (id === "web-dev")      return <WebDevIcon size={size} />;
  if (id === "data-science") return <DataIcon size={size} />;
  if (id === "cybersecurity")return <ShieldIcon size={size} />;
  if (id === "bpo")          return <HeadphonesIcon size={size} />;
  if (id === "behavioral")   return <HandshakeIcon size={size} />;
  if (id === "mobile-dev")   return <SmartphoneIcon size={size} />;
  if (id === "cloud-devops") return <CloudIcon size={size} />;
  if (id === "ui-ux")        return <PenToolIcon size={size} />;
  if (id === "database")     return <DatabaseIcon size={size} />;
  if (id === "networking")   return <NetworkIcon size={size} />;
  if (id === "qa-testing")   return <FlaskIcon size={size} />;
  if (id === "game-dev")     return <GamepadIcon size={size} />;
  // Default for all newly added interview categories: Robot icon
  return <BotIcon size={size} />;
}

const EditIcon = ({ size = 14 }: { size?: number }) => (
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

const TrashIcon = ({ size = 14 }: { size?: number }) => (
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

export default function CategoryCard({
  category,
  pipeline,
  questionCount,
  isAdmin = false,
  onSelect,
  onEdit,
  onDelete,
  onDeactivate,
  onReactivate,
  onManageQuestions,
}: CategoryCardProps) {
  return (
    <div
      onClick={!isAdmin ? onSelect : undefined}
      className={`bg-white rounded-[32px] p-6 text-left border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group ${
        !isAdmin ? "cursor-pointer hover:border-[#b8d0ff]" : ""
      } ${category.deactivated ? "opacity-75 bg-slate-50/50" : ""}`}
    >
      <div>
        {/* Header: Category Icon + optional Admin Actions */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0"
              style={{ background: category.bg, color: category.color }}
            >
              <CategoryIcon id={category.id} size={24} />
            </div>
            {category.deactivated && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wider">
                Deactivated
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1.5 shrink-0">
              {category.deactivated ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReactivate?.(category);
                  }}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                  title="Reactivate Interview Category"
                >
                  Reactivate
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(category);
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#0066FF] flex items-center justify-center transition-colors cursor-pointer"
                    title="Edit Category Info"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeactivate) {
                        onDeactivate(category);
                      } else {
                        onDelete?.(category.id);
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Deactivate Category"
                  >
                    <PowerIcon size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Category Name */}
        <h3
          className="text-[17px] font-bold text-[#0F172A] leading-snug mb-1.5 group-hover:text-[#0066FF] transition-colors"
          style={{ fontFamily: "'DM Serif Text', serif" }}
        >
          {category.name}
        </h3>

        {/* Description */}
        <p className="text-[12.5px] text-slate-400 mb-5 leading-relaxed line-clamp-2">
          {category.description}
        </p>
      </div>

      {/* Footer Details / Actions */}
      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
        <span
          className="text-[11px] px-3 py-1 rounded-full font-medium"
          style={{ color: category.color, background: category.bg }}
        >
          {isAdmin && questionCount !== undefined
            ? `${questionCount} questions`
            : pipeline || "Intro → Situational → Technical → Coding → Q&A"}
        </span>

        {isAdmin ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onManageQuestions?.(category);
            }}
            className="text-[12px] font-semibold text-[#0066FF] hover:underline cursor-pointer"
          >
            Manage Questions →
          </button>
        ) : (
          <span className="text-[12px] font-semibold text-[#0073ff] opacity-0 group-hover:opacity-100 transition-opacity">
            Practice →
          </span>
        )}
      </div>
    </div>
  );
}

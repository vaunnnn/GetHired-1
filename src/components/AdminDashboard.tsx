"use client"

/* ═══════════════════════════════ SVG ICONS ═══════════════════════════ */

/* Available specialization tags */

/* ═══════════════════════════════ IMAGE CROPPER MODAL ═════════════════ */

// Load and preview image

// Compute scaled cover dimensions
/* Live Canvas Preview */ /* Controls */ /* Action Buttons */

/* ═══════════════════════════════ MAIN ADMIN COMPONENT ═════════════════ */

// States for Companies

// Company Form state

// States for Interview Categories & Questions

// Question Form state (inside Question Manager)

// Confirmation Modal state for Deactivation / Reactivation

/* ── Company Actions ── */

/* ── Interview Actions ── */

/* Filtered Data */ /* ═══ ADMIN SIDEBAR (Desktop) ═══ */ /* Logo & Admin Tag */ /* Navigation items */ /* Centered Logout */ /* ═══ MAIN WORKSPACE ═══ */ /* Floating Top Header Card */ /* Mobile logo icon */ /* Content Body */ /* ════════════════════ TAB 1: COMPANIES ════════════════════ */ /* Header Bar with Filters and Add Button */ /* Search input */ /* Niche / Specialization filter dropdown */ /* Status Filter Dropdown */ /* Companies Grid using shared CompanyCard component */ /* ════════════════════ TAB 2: STUDENTS ════════════════════ */ /* If a category is selected to manage its questions */ /* Category Banner with icon */ /* Questions List */
/* Category List Overview */ /* ═══ Mobile Bottom Admin Navigation Bar ═══ */ /* ════════════════════ MODALS ════════════════════ */ /* ── Add / Edit Company Modal ── */ /* Specializations / Categories pills */ /* ── Add / Edit Category Modal ── */ /* ── Add / Edit Question Modal ── */ /* ── Confirmation Modal (Deactivate / Reactivate / Delete) ── */

import React, { useState, useRef, useEffect } from "react"
import { useSession } from "./SessionProvider"
import StudentRegistry from "./StudentRegistry"
import CompanyCard from "./CompanyCard"
import CategoryCard, { CategoryIcon } from "./CategoryCard"
import {
  bankList,
  categoryView,
  questionView,
  type InterviewCategory,
  type InterviewQuestion,
} from "@/lib/interviews"
import {
  DEFAULT_PHASES,
  QUESTION_TYPES,
  MCQ_QUESTION_TYPES,
  type Category,
  type Question,
  type PhaseConfig,
} from "@gethired/contracts"
import PipelineEditor from "./PipelineEditor"
import QuestionResponseEditor from "./QuestionResponseEditor"

import { apiClient } from "@/lib/api-client"
import { companyView, type Company } from "@/lib/companies"
import {
  COMPANY_SPECIALIZATIONS,
  type Company as CompanyDto,
  type CompanyInput,
} from "@gethired/contracts"
import CompanyResults, { useCompanyPage } from "./CompanyResults"

type AdminTab = "companies" | "students" | "interviews"
const BuildingIcon = ({ size = 18 }: { size?: number }) => (
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
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </svg>
)

const UsersIcon = ({ size = 18 }: { size?: number }) => (
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
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const MicIcon = ({ size = 18 }: { size?: number }) => (
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
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
  </svg>
)

const PlusIcon = ({ size = 16 }: { size?: number }) => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const SearchIcon = ({ size = 16 }: { size?: number }) => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
)

const EditIcon = ({ size = 15 }: { size?: number }) => (
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

const TrashIcon = ({ size = 15 }: { size?: number }) => (
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
)

const LogOutIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
)

const XIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CropIcon = ({ size = 16 }: { size?: number }) => (
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
    <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
    <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
  </svg>
)

const UploadIcon = ({ size = 18 }: { size?: number }) => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const CopyIcon = ({ size = 13 }: { size?: number }) => (
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
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const CheckIcon = ({ size = 14 }: { size?: number }) => (
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
)

interface ConfirmActionState {
  type: "deactivate" | "reactivate" | "delete"
  target: "company" | "category" | "question" | "student"
  id?: string | number
  idx?: number
  name: string
}

const FilterIcon = ({ size = 14 }: { size?: number }) => (
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

const ChevronDownIcon = ({
  size = 14,
  className = "",
}: {
  size?: number
  className?: string
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

interface AdminFilterOption {
  label: string
  value: string
}

function AdminFilterDropdown({
  value,
  options,
  onChange,
  label = "Filter",
  prefix,
  ariaLabel,
}: {
  value: string
  options: (string | AdminFilterOption)[]
  onChange: (val: string) => void
  label?: string
  prefix?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const normalizedOptions: AdminFilterOption[] = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt,
  )

  const selectedOpt = normalizedOptions.find((opt) => opt.value === value) || {
    label: value || "All",
    value: value,
  }

  const isFiltered = value !== "" && value !== "All" && value !== "all"

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        aria-label={ariaLabel || label}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[13px] font-medium transition-all shadow-2xs cursor-pointer ${
          isFiltered
            ? "bg-[#EEF5FF] border-[#0066FF] text-[#0066FF] font-semibold"
            : "bg-white border-slate-200 text-slate-700 hover:border-[#0066FF] hover:text-[#0066FF]"
        }`}
      >
        <FilterIcon size={13} />
        <span className="truncate max-w-[170px]">
          {prefix && <span className="font-normal opacity-70">{prefix} </span>}
          {selectedOpt.label}
        </span>
        <ChevronDownIcon
          size={13}
          className={`transition-transform duration-200 text-slate-400 ${
            open ? "rotate-180 text-[#0066FF]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-40 min-w-[220px] max-h-[320px] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            {label}
          </div>
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer text-left ${
                  isSelected
                    ? "bg-[#EEF5FF] text-[#0066FF] font-semibold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="truncate pr-2">{opt.label}</span>
                {isSelected && <CheckIcon size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FormSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string
  options: string[] | { label: string; value: string }[]
  onChange: (val: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const selectedLabel =
    typeof options[0] ===
    "string"
      ? value
      : (options as { label: string; value: string }[]).find(
          (o) =>
            o.value ===
            value,
        )?.label ||
        value

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full bg-slate-50/70 border rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-800 flex items-center justify-between outline-none transition-all cursor-pointer shadow-2xs ${
          open
            ? "border-[#0066FF] ring-2 ring-[#0066FF]/10 bg-white"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className="truncate">
          {selectedLabel || placeholder || "Select option"}
        </span>
        <ChevronDownIcon
          size={14}
          className={`transition-transform duration-200 text-slate-400 shrink-0 ml-2 ${
            open ? "rotate-180 text-[#0066FF]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full z-50 max-h-[220px] overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => {
            const optVal =
              typeof opt ===
              "string"
                ? opt
                : opt.value
            const optLabel =
              typeof opt ===
              "string"
                ? opt
                : opt.label
            const isSelected =
              optVal ===
              value
            return (
              <button
                key={optVal}
                type="button"
                onClick={() => {
                  onChange(optVal)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer text-left ${
                  isSelected
                    ? "bg-[#EEF5FF] text-[#0066FF] font-semibold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="truncate pr-2">{optLabel}</span>
                {isSelected && <CheckIcon size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
const ALL_SPECIALIZATIONS = COMPANY_SPECIALIZATIONS
function ImageCropperModal({
  imageSrc,
  onApply,
  onClose,
}: {
  imageSrc: string
  onApply: (croppedDataUrl: string) => void
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageSrc
    img.onload = () => {
      imgRef.current = img
      renderPreview()
    }
  }, [imageSrc])

  useEffect(() => {
    renderPreview()
  }, [zoom, offsetX, offsetY])

  const renderPreview = () => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const targetWidth = 600
    const targetHeight = 260
    canvas.width = targetWidth
    canvas.height = targetHeight

    ctx.clearRect(0, 0, targetWidth, targetHeight)
    const scale =
      Math.max(
        targetWidth /
          img.width,
        targetHeight /
          img.height,
      ) *
      zoom
    const sw =
      targetWidth /
      scale
    const sh =
      targetHeight /
      scale

    const sx = Math.max(
      0,
      Math.min(
        img.width -
          sw,
        (img.width - sw) / 2 + offsetX * (img.width / 200),
      ),
    )
    const sy = Math.max(
      0,
      Math.min(
        img.height -
          sh,
        (img.height - sh) / 2 + offsetY * (img.height / 200),
      ),
    )

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
  }

  const handleSaveCrop = () => {
    if (canvasRef.current) {
      const croppedUrl = canvasRef.current.toDataURL("image/jpeg", 0.9)
      onApply(croppedUrl)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] w-full max-w-[620px] p-6 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3
              className="text-[19px] font-bold text-[#0F172A]"
              style={{ fontFamily: "'DM Serif Display', serif" }}
            >
              Crop Company Cover Photo
            </h3>
            <p className="text-[12.5px] text-slate-400">
              Adjust zoom and position to fit the 600×260 company card banner.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <XIcon />
          </button>
        </div>

        {}
        <div className="relative w-full aspect-[600/260] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex items-center justify-center mb-5">
          <canvas ref={canvasRef} className="w-full h-full object-cover" />
          <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-[#0066FF]/40 rounded-2xl" />
        </div>

        {}
        <div className="space-y-3.5 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <div className="flex justify-between text-[12px] font-medium text-slate-600 mb-1">
              <span>Zoom</span>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-[#0066FF] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-[12px] font-medium text-slate-600 mb-1">
                <span>Pan X</span>
                <span>
                  {offsetX >
                  0
                    ? `+${offsetX}`
                    : offsetX}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={offsetX}
                onChange={(e) => setOffsetX(parseInt(e.target.value))}
                className="w-full accent-[#0066FF] cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[12px] font-medium text-slate-600 mb-1">
                <span>Pan Y</span>
                <span>
                  {offsetY >
                  0
                    ? `+${offsetY}`
                    : offsetY}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value))}
                className="w-full accent-[#0066FF] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 text-slate-600 text-[14px] font-semibold rounded-full hover:bg-slate-50 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            className="flex-1 py-3 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[14px] font-semibold rounded-full transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Apply Cropped Photo
          </button>
        </div>
      </div>
    </div>
  )
}
export default function AdminDashboard() {
  const { user, logout } = useSession()

  const [activeTab, setActiveTab] = useState<AdminTab>("companies")
  const [collapsed, setCollapsed] = useState(false)

  const [companySearch, setCompanySearch] = useState("")
  const [selectedNiche, setSelectedNiche] = useState<string>("All")
  const [companyStatus, setCompanyStatus] = useState("all")
  const [companyRevision, setCompanyRevision] = useState(0)
  const query = new URLSearchParams({ q: companySearch })
  if (
    companyStatus !==
    "all"
  )
    query.set("status", companyStatus)
  if (
    selectedNiche !==
    "All"
  )
    query.set("specialization", selectedNiche)
  const companyResults = useCompanyPage<CompanyDto>(
    "/api/admin/companies",
    query.toString(),
    companyRevision,
    activeTab ===
      "companies",
  )
  const companies = companyResults.data.map((c) => companyView(c))
  const [verificationOverrides, setVerificationOverrides] = useState<
    Record<string, { verified: boolean; verified_on?: string }>
  >(() => {
    if (typeof window === "undefined") return {}
    try {
      return JSON.parse(
        localStorage.getItem("gethired_verified_overrides") || "{}",
      )
    } catch {
      return {}
    }
  })
  const [companyError, setCompanyError] = useState("")
  const [companyBusy, setCompanyBusy] = useState(false)
  const companyLock = useRef(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null)
  const [compForm, setCompForm] = useState<Partial<Company>>({
    name: "",
    industry: "Software Development",
    type: "Software Services",
    location: "Cebu City",
    slots: 5,
    description: "",
    website: "",
    email: "",
    phone: "",
    hours: "Mon – Fri, 8:00 AM – 5:00 PM",
    image: "",
    specializations: ["Software Dev"],
  })
  const [categories, setCategories] = useState<InterviewCategory[]>([])
  const [questionsMap, setQuestionsMap] =
    useState<Record<string, InterviewQuestion[]>>({})
  const [selectedCategoryForQuestions, setSelectedCategoryForQuestions] =
    useState<InterviewCategory | null>(null)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] =
    useState<InterviewCategory | null>(null)
  const [phaseForm, setPhaseForm] = useState<PhaseConfig[]>(DEFAULT_PHASES)
  const [catForm, setCatForm] = useState({
    name: "",
    description: "",
    color: "#0066FF",
    bg: "#dfe9ff",
  })
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)
  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(
    null,
  )
  const [questionForm, setQuestionForm] = useState<InterviewQuestion>({
    question: "",
    type: "Technical",
    hint: "",
    feedback: "",
    responseDefinition: { format: "written" },
    status: "active",
  })

  const [bankRevision, setBankRevision] = useState(0)
  const [bankError, setBankError] = useState("")
  const [bankLoading, setBankLoading] = useState(true)
  const bankLock = useRef(false)
  const loadedCategories = useRef({ revision: -1, at: 0 })
  const loadedQuestions = useRef<Record<string, {
    revision: number
    at: number
  }>>({})
  useEffect(() => {
    const age =
      Date.now() -
      loadedCategories.current.at
    if (
      activeTab !==
        "interviews" ||
      (loadedCategories.current.revision ===
        bankRevision &&
        age >=
          0 &&
        age <
          30000)
    )
      return
    let live = true
    setBankLoading(true)
    setBankError("")
    bankList<Category>("/api/admin/categories")
      .then((rows) => {
        if (live) {
          setCategories(rows.map(categoryView))
          loadedCategories.current = { revision: bankRevision, at: Date.now() }
        }
      })
      .catch((error) => {
        if (live) setBankError(error.message)
      })
      .finally(() => {
        if (live) setBankLoading(false)
      })
    return () => {
      live = false
    }
  }, [bankRevision, activeTab])
  useEffect(() => {
    if (
      activeTab !==
        "interviews" ||
      !selectedCategoryForQuestions
    )
      return
    let live = true
    const id = selectedCategoryForQuestions.id
    const cached = loadedQuestions.current[id]
    const age = cached
      ? Date.now() -
        cached.at
      : Infinity
    if (
      cached?.revision ===
        bankRevision &&
      age >=
        0 &&
      age <
        30000
    )
      return
    bankList<Question>(`/api/admin/categories/${id}/questions`)
      .then((rows) => {
        if (live) {
          setQuestionsMap((prev) => ({ ...prev, [id]: rows.map(questionView) }))
          loadedQuestions.current[id] = {
            revision: bankRevision,
            at: Date.now(),
          }
        }
      })
      .catch((error) => {
        if (live) setBankError(error.message)
      })
    return () => {
      live = false
    }
  }, [selectedCategoryForQuestions?.id, bankRevision, activeTab])
  const bankWrite = async (
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    done?: () => void,
  ) => {
    if (bankLock.current) return
    bankLock.current = true
    setBankError("")
    try {
      await apiClient.mutate(path, method, body)
      setBankRevision(
        (n) =>
          n +
          1,
      )
      done?.()
    } catch (error) {
      setBankError(
        error instanceof
          Error
          ? error.message
          : "Unable to save changes.",
      )
    } finally {
      bankLock.current = false
    }
  }
  const [confirmModal, setConfirmModal] = useState<ConfirmActionState | null>(
    null,
  )

  const handleRequestDeactivateCompany = (company: Company) => {
    setConfirmModal({
      type: "deactivate",
      target: "company",
      id: company.id,
      name: company.name,
    })
  }

  const handleRequestReactivateCompany = (company: Company) => {
    setConfirmModal({
      type: "reactivate",
      target: "company",
      id: company.id,
      name: company.name,
    })
  }

  const handleRequestDeactivateCategory = (cat: InterviewCategory) => {
    setConfirmModal({
      type: "deactivate",
      target: "category",
      id: cat.id,
      name: cat.name,
    })
  }

  const handleRequestReactivateCategory = (cat: InterviewCategory) => {
    setConfirmModal({
      type: "reactivate",
      target: "category",
      id: cat.id,
      name: cat.name,
    })
  }

  const handleRequestDeactivateQuestion = (idx: number) => {
    setConfirmModal({
      type: "deactivate",
      target: "question",
      idx,
      name: `Question #${idx + 1}`,
    })
  }

  const handleRequestReactivateQuestion = (idx: number) => {
    setConfirmModal({
      type: "reactivate",
      target: "question",
      idx,
      name: `Question #${idx + 1}`,
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmModal) return
    const { type, target, id, idx } = confirmModal

    if (target === "company") {
      if (companyLock.current) return
      companyLock.current = true
      setCompanyError("")
      try {
        await apiClient.mutate(`/api/admin/companies/${id}`, "PATCH", {
          status: type === "deactivate" ? "inactive" : "active",
        })
        setCompanyRevision((n) => n + 1)
      } catch (error) {
        setCompanyError(
          error instanceof Error ? error.message : "Unable to update company.",
        )
      } finally {
        companyLock.current = false
      }
    } else if (target === "category") {
      await bankWrite(`/api/admin/categories/${id}`, "PATCH", {
        status: type === "deactivate" ? "inactive" : "active",
      })
    } else if (
      target === "question" &&
      selectedCategoryForQuestions &&
      idx !== undefined
    ) {
      const question = questionsMap[selectedCategoryForQuestions.id]?.[idx]
      if (question?.id)
        await bankWrite(`/api/admin/questions/${question.id}`, "PATCH", {
          status: type === "deactivate" ? "inactive" : "active",
        })
    }

    setConfirmModal(null)
  }
  const handleOpenAddCompany = () => {
    setCompanyError("")
    setEditingCompany(null)
    setCompForm({
      name: "",
      industry: "Software Development",
      type: "Software Services",
      location: "Cebu IT Park, Cebu City",
      slots: 5,
      description: "",
      website: "",
      email: "",
      phone: "+63 32 412 8888",
      hours: "Mon – Fri, 9:00 AM – 6:00 PM",
      image: "",
      specializations: ["Software Dev", "React / Node.js"],
      verified: true,
      verified_on: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    })
    setIsCompanyModalOpen(true)
  }

  const handleOpenEditCompany = (c: Company) => {
    setCompanyError("")
    setEditingCompany(c)
    const override = verificationOverrides[c.id]
    const isV =
      override !== undefined ? override.verified : c.verified !== false
    setCompForm({
      ...c,
      verified: isV,
      verified_on:
        override?.verified_on ||
        c.verified_on ||
        new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    })
    setIsCompanyModalOpen(true)
  }

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (companyLock.current) return
    companyLock.current = true
    setCompanyBusy(true)
    setCompanyError("")
    try {
      const input: CompanyInput = {
        name: compForm.name ?? "",
        industry: compForm.industry ?? "",
        type: compForm.type ?? "",
        location: compForm.location ?? "",
        slots: Number(compForm.slots ?? 0),
        description: compForm.description ?? "",
        specializations: compForm.specializations ?? [],
        website: compForm.website ?? "",
        email: compForm.email ?? "",
        phone: compForm.phone ?? "",
        hours: compForm.hours ?? "",
      }
      if (compForm.image?.startsWith("data:")) {
        const blob = await (await fetch(compForm.image)).blob()
        const form = new FormData()
        form.append("file", blob, "company.jpg")
        const upload = await apiClient.mutate<{ imageId: string }>(
          "/api/admin/company-images",
          "POST",
          form,
        )
        input.imageId = upload.imageId
      } else if (!compForm.image) input.imageId = null
      await apiClient.mutate(
        editingCompany
          ? `/api/admin/companies/${editingCompany.id}`
          : "/api/admin/companies",
        editingCompany ? "PATCH" : "POST",
        input,
      )

      if (editingCompany) {
        setVerificationOverrides((prev) => {
          const next = {
            ...prev,
            [editingCompany.id]: {
              verified: compForm.verified !== false,
              verified_on:
                compForm.verified !== false
                  ? compForm.verified_on ||
                    new Date().toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : undefined,
            },
          }
          try {
            localStorage.setItem(
              "gethired_verified_overrides",
              JSON.stringify(next),
            )
          } catch {}
          return next
        })
      }

      setCompanyRevision((n) => n + 1)
      setIsCompanyModalOpen(false)
    } catch (error) {
      setCompanyError(
        error instanceof Error ? error.message : "Unable to save company.",
      )
    } finally {
      companyLock.current = false
      setCompanyBusy(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setCompanyError("Choose a JPEG, PNG or WebP image up to 2 MiB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      const data = reader.result
      const image = new Image()
      image.onload = () => {
        if (image.width > 4096 || image.height > 4096) {
          setCompanyError("Images must be at most 4096 pixels per side.")
          return
        }
        setCompanyError("")
        setCropModalSrc(data)
      }
      image.onerror = () => setCompanyError("Unable to read this image.")
      image.src = data
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const toggleSpec = (spec: string) => {
    const current = compForm.specializations || []
    if (current.includes(spec)) {
      setCompForm({
        ...compForm,
        specializations: current.filter((s) => s !== spec),
      })
    } else {
      setCompForm({ ...compForm, specializations: [...current, spec] })
    }
  }
  const handleOpenAddCategory = () => {
    setPhaseForm(DEFAULT_PHASES)
    setBankError("")
    setEditingCategory(null)
    setCatForm({
      name: "",
      description: "",
      color: "#0066FF",
      bg: "#dfe9ff",
    })
    setIsCategoryModalOpen(true)
  }

  const handleOpenEditCategory = (cat: InterviewCategory) => {
    setPhaseForm(cat.phases)
    setBankError("")
    setEditingCategory(cat)
    setCatForm({
      name: cat.name,
      description: cat.description,
      color: cat.color,
      bg: cat.bg,
    })
    setIsCategoryModalOpen(true)
  }

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    await bankWrite(
      editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : "/api/admin/categories",
      editingCategory ? "PATCH" : "POST",
      { ...catForm, phases: phaseForm },
      () => setIsCategoryModalOpen(false),
    )
  }

  const handleOpenAddQuestion = () => {
    setBankError("")
    setEditingQuestionIdx(null)
    setQuestionForm({
      question: "",
      type: "Technical",
      hint: "",
      feedback: "",
      responseDefinition: { format: "written" },
      status: "active",
    })
    setIsQuestionModalOpen(true)
  }

  const handleOpenEditQuestion = (idx: number, q: InterviewQuestion) => {
    setBankError("")
    setEditingQuestionIdx(idx)
    setQuestionForm({ ...q })
    setIsQuestionModalOpen(true)
  }

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategoryForQuestions) return
    const id =
      editingQuestionIdx === null
        ? undefined
        : questionsMap[selectedCategoryForQuestions.id]?.[editingQuestionIdx]
            ?.id
    const { question, type, hint, feedback, responseDefinition, status } =
      questionForm
    if (responseDefinition.format === "multiple_choice") {
      const labels = responseDefinition.options.map((option) =>
        option.text.trim().toLowerCase(),
      )
      if (
        labels.some((label) => !label) ||
        new Set(labels).size !== labels.length
      ) {
        setBankError("Enter a different, non-empty answer for each choice.")
        return
      }
      if (
        !responseDefinition.options.some(
          (option) => option.id === responseDefinition.correctOptionId,
        )
      ) {
        setBankError("Select one correct answer.")
        return
      }
    } else if (status !== "inactive" && !feedback.trim()) {
      setBankError(
        "Add evaluation criteria before activating a written question.",
      )
      return
    }
    await bankWrite(
      id
        ? `/api/admin/questions/${id}`
        : `/api/admin/categories/${selectedCategoryForQuestions.id}/questions`,
      id ? "PATCH" : "POST",
      { question, type, hint, feedback, responseDefinition, status },
      () => setIsQuestionModalOpen(false),
    )
  }
  const filteredCompanies = companies.map((c) => {
    const override = verificationOverrides[c.id]
    if (override !== undefined) {
      return {
        ...c,
        verified: override.verified,
        verified_on: override.verified_on ?? c.verified_on,
      }
    }
    return c
  })

  return (
    <div
      className="h-screen flex bg-[#f5f7ff] overflow-hidden text-slate-800"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
    >
      {}
      <div
        className="hidden md:flex p-3 shrink-0 flex-col transition-all duration-300"
        style={{ width: collapsed ? 88 : 260 }}
      >
        <aside
          className={`bg-white rounded-[36px] flex flex-col py-6 overflow-hidden h-full shadow-sm border border-slate-100 ${
            collapsed ? "px-2.5" : ""
          }`}
        >
          {}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`mb-8 cursor-pointer flex items-center transition-all ${
              collapsed
                ? "px-0 justify-center w-full"
                : "px-5 gap-2.5 text-left"
            }`}
          >
            <img
              src="/getHiredLogo.png"
              alt="GetHired Logo"
              className="w-10 h-10 object-contain shrink-0"
            />
            {!collapsed && (
              <div>
                <div className="text-[20px] font-bold tracking-tight text-[#0066FF] leading-tight">
                  GetHired
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Admin Console
                </div>
              </div>
            )}
          </button>

          {}
          <nav
            className={`flex flex-col gap-1.5 flex-1 ${
              collapsed ? "px-0" : "px-2"
            }`}
          >
            {[
              {
                id: "companies",
                label: "Companies",
                badge: companyResults.meta.total,
                Icon: BuildingIcon,
              },
              {
                id: "students",
                label: "Students",
                badge: undefined,
                Icon: UsersIcon,
              },
              {
                id: "interviews",
                label: "Interviews",
                badge: categories.length,
                Icon: MicIcon,
              },
            ].map(({ id, label, badge, Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id as AdminTab)
                  setSelectedCategoryForQuestions(null)
                }}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 py-3 rounded-[24px] text-[14px] font-medium transition-all cursor-pointer ${
                  collapsed ? "justify-center px-0 w-full" : "px-4"
                } ${
                  activeTab === id
                    ? "bg-[#0066FF] text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 hover:text-[#0066FF] hover:bg-[#dfe9ff]/60"
                }`}
              >
                <Icon size={18} />
                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between text-left">
                    <span>{label}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        activeTab === id
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {badge}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </nav>

          {}
          <div className="px-2 flex justify-center">
            <button
              onClick={logout}
              title={collapsed ? "Log out" : undefined}
              className="flex items-center justify-center gap-2 py-3 rounded-[24px] text-[13.5px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all w-full cursor-pointer"
            >
              <LogOutIcon />
              {!collapsed && <span>Log out</span>}
            </button>
          </div>
        </aside>
      </div>

      {}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/40">
        {}
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 shrink-0">
          <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 sm:py-4.5 bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {}
              <div className="flex items-center gap-1.5 md:hidden shrink-0">
                <img
                  src="/getHiredLogo.png"
                  alt="GetHired Logo"
                  className="w-7 h-7 object-contain"
                />
              </div>
              <h1 className="text-[17px] sm:text-[21px] lg:text-[24px] font-bold text-[#0066FF] tracking-tight truncate">
                {activeTab === "companies" && "Industry Partners"}
                {activeTab === "students" && "DCISM Student Registry"}
                {activeTab === "interviews" &&
                  (selectedCategoryForQuestions
                    ? `${selectedCategoryForQuestions.name} Questions`
                    : "Interview Categories")}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200/90 rounded-full pl-1.5 pr-3 sm:pr-4 py-1.5 shadow-2xs">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0066FF] text-white font-bold text-[12px] sm:text-[13px] flex items-center justify-center">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="text-left leading-tight hidden sm:block">
                  <div className="text-[12.5px] font-semibold text-slate-700">
                    {user.displayName}
                  </div>
                  <div className="text-[11px] text-slate-400">{user.email}</div>
                </div>
              </div>
            </div>
          </header>
        </div>

        {}
        <main className="flex-1 px-4 sm:px-8 py-4 sm:py-6 pb-24 md:pb-6 overflow-y-auto">
          {}
          {activeTab === "companies" && (
            <div>
              {}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-3xl">
                  {}
                  <div className="relative flex-1 min-w-[220px]">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <SearchIcon size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Search company name, location, niche..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-full pl-10 pr-4 py-2 text-[13px] outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all text-slate-700 placeholder:text-slate-400"
                    />
                  </div>

                  {}
                  <AdminFilterDropdown
                    value={selectedNiche}
                    options={["All", ...ALL_SPECIALIZATIONS]}
                    onChange={setSelectedNiche}
                    label="Specialization / Niche"
                  />

                  {}
                  <AdminFilterDropdown
                    ariaLabel="Company status"
                    value={companyStatus}
                    options={[
                      { label: "All", value: "all" },
                      { label: "Active", value: "active" },
                      { label: "Inactive", value: "inactive" },
                    ]}
                    onChange={setCompanyStatus}
                    label="Company Status"
                    prefix="Status:"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddCompany}
                  className="inline-flex items-center gap-2 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98 shrink-0"
                >
                  <PlusIcon size={16} />
                  <span>Add Company</span>
                </button>
              </div>

              {companyError && (
                <p role="alert" className="text-red-600 text-sm mb-3">
                  {companyError}
                </p>
              )}
              <CompanyResults {...companyResults} />

              {}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredCompanies.map((c) => (
                  <CompanyCard
                    key={c.id}
                    company={c}
                    isAdmin={true}
                    onEdit={handleOpenEditCompany}
                    onDeactivate={handleRequestDeactivateCompany}
                    onReactivate={handleRequestReactivateCompany}
                  />
                ))}
              </div>

              {filteredCompanies.length === 0 && (
                <div className="bg-white rounded-[28px] p-12 text-center text-slate-400 text-[14px] border border-slate-200/80">
                  {companyResults.loading
                    ? "Loading industry partners…"
                    : companyResults.error
                      ? "Industry partners are unavailable."
                      : "No industry partners match your query."}
                </div>
              )}
            </div>
          )}

          {}
          {activeTab === "students" && <StudentRegistry />}

          {activeTab === "interviews" && (
            <div>
              {bankLoading && <p role="status">Loading categories…</p>}
              {bankError && (
                <p role="alert" className="text-red-600">
                  {bankError}{" "}
                  <button onClick={() => setBankRevision((n) => n + 1)}>
                    Retry
                  </button>
                </p>
              )}
              {}
              {selectedCategoryForQuestions ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryForQuestions(null)}
                      className="inline-flex items-center gap-2 text-slate-500 hover:text-[#0066FF] text-[13.5px] font-semibold transition-colors cursor-pointer"
                    >
                      <span>← Back to all Categories</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddQuestion}
                      className="inline-flex items-center gap-2 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] font-semibold px-4.5 py-2 rounded-full transition-all cursor-pointer shadow-sm"
                    >
                      <PlusIcon size={15} />
                      <span>Add Question</span>
                    </button>
                  </div>

                  {}
                  <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 mb-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs"
                        style={{
                          background: selectedCategoryForQuestions.bg,
                          color: selectedCategoryForQuestions.color,
                        }}
                      >
                        <CategoryIcon
                          id={selectedCategoryForQuestions.id}
                          size={26}
                        />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Interview Track
                          </span>
                        </div>
                        <h2 className="text-[22px] font-bold text-slate-700">
                          {selectedCategoryForQuestions.name} Questions
                        </h2>
                        <p className="text-[13px] text-slate-400 mt-0.5">
                          {selectedCategoryForQuestions.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[13px] font-bold text-[#0066FF] bg-blue-50 px-3.5 py-1.5 rounded-full">
                        {
                          (questionsMap[selectedCategoryForQuestions.id] || [])
                            .length
                        }{" "}
                        questions
                      </span>
                    </div>
                  </div>

                  {}
                  <div className="space-y-4">
                    {(questionsMap[selectedCategoryForQuestions.id] || []).map(
                      (q, idx) => (
                        <div
                          key={idx}
                          className={`bg-white rounded-[24px] p-6 border border-slate-200/80 shadow-2xs hover:border-[#0066FF]/40 transition-all ${
                            q.deactivated ? "opacity-75 bg-slate-50/50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Question #{idx + 1}
                                </span>
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {q.type}
                                </span>
                                {q.deactivated && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wider">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                              <h4 className="text-[15px] font-semibold text-[#0F172A] leading-snug">
                                {q.question}
                              </h4>
                              {q.hint && (
                                <div className="mt-2.5 text-[12.5px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <span className="font-semibold text-slate-700">
                                    Hint:
                                  </span>{" "}
                                  {q.hint}
                                </div>
                              )}
                              <p className="mt-2 text-xs font-semibold text-slate-500">
                                {q.responseDefinition.format ===
                                "multiple_choice"
                                  ? "Multiple choice"
                                  : "Written response"}
                              </p>
                              {q.responseDefinition.format === "written" &&
                                q.feedback && (
                                  <div className="mt-2 text-[12px] text-blue-700 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                    <span className="font-semibold text-blue-900">
                                      AI Evaluation Rubric:
                                    </span>{" "}
                                    {q.feedback}
                                  </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {q.deactivated ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestReactivateQuestion(idx)
                                  }
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[11px] font-bold transition-colors cursor-pointer shadow-sm"
                                  title="Reactivate Question"
                                >
                                  Reactivate
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenEditQuestion(idx, q)
                                    }
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#0066FF] flex items-center justify-center transition-colors cursor-pointer"
                                    title="Edit Question"
                                  >
                                    <EditIcon size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRequestDeactivateQuestion(idx)
                                    }
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Deactivate Question"
                                  >
                                    <PowerIcon size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ),
                    )}

                    {(!questionsMap[selectedCategoryForQuestions.id] ||
                      questionsMap[selectedCategoryForQuestions.id].length ===
                        0) && (
                      <div className="text-center py-12 bg-white rounded-[24px] border border-slate-200 text-slate-400 text-[14px]">
                        No questions in this category yet. Click &quot;Add
                        Question&quot; above to create one.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                    <div className="inline-flex items-center gap-2 bg-[#EEF5FF] text-[#0066FF] border border-[#0066FF]/20 px-4 py-2 rounded-full text-[13px] font-medium shadow-2xs">
                      <span>Select a category to view and customize its question sets, or add a new category.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddCategory}
                      className="inline-flex items-center justify-center gap-2 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13.5px] font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98 shrink-0"
                    >
                      <PlusIcon size={16} />
                      <span>Add Category</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {categories.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        category={cat}
                        pipeline={cat.pipeline}
                        questionCount={questionsMap[cat.id]?.length}
                        isAdmin={true}
                        onEdit={handleOpenEditCategory}
                        onDeactivate={handleRequestDeactivateCategory}
                        onReactivate={handleRequestReactivateCategory}
                        onManageQuestions={setSelectedCategoryForQuestions}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {}
      <nav
        aria-label="Admin Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shadow-lg"
      >
        {[
          {
            id: "companies",
            label: "Companies",
            badge: companyResults.meta.total,
            Icon: BuildingIcon,
          },
          {
            id: "students",
            label: "Students",
            badge: undefined,
            Icon: UsersIcon,
          },
          {
            id: "interviews",
            label: "Interviews",
            badge: categories.length,
            Icon: MicIcon,
          },
        ].map(({ id, label, badge, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setActiveTab(id as AdminTab)
              setSelectedCategoryForQuestions(null)
            }}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-[11px] font-medium transition-all relative ${
              activeTab === id
                ? "text-[#0066FF] font-semibold"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-all relative ${
                activeTab === id ? "bg-[#0066FF]/10 text-[#0066FF]" : ""
              }`}
            >
              <Icon size={18} />
              <span className="absolute -top-1 -right-1.5 bg-slate-200 text-slate-700 text-[9px] font-bold px-1 rounded-full leading-tight">
                {badge}
              </span>
            </div>
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-[11px] font-medium text-slate-400 hover:text-red-500 transition-all cursor-pointer"
        >
          <div className="p-1">
            <LogOutIcon />
          </div>
          <span>Logout</span>
        </button>
      </nav>

      {}

      {}
      {/* ── Add / Edit Company Modal ── */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-[640px] p-6 sm:p-8 shadow-2xl border border-slate-100 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div>
                <h3 className="text-[20px] font-bold text-slate-800">
                  {editingCompany
                    ? "Edit Industry Partner"
                    : "Add Industry Partner"}
                </h3>
                <p className="text-[12.5px] text-slate-400 mt-0.5">
                  Update company profile details, contact info, and specializations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              {companyError && (
                <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span>{companyError}</span>
                </div>
              )}
              <fieldset disabled={companyBusy} className="space-y-4">
                {/* Verification Status Control */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Verification Status
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70">
                    <button
                      type="button"
                      onClick={() =>
                        setCompForm({
                          ...compForm,
                          verified: true,
                          verified_on:
                            compForm.verified_on ||
                            new Date().toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }),
                        })
                      }
                      className={`py-2 px-3 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer text-center ${
                        compForm.verified !== false
                          ? "bg-[#0066FF] text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Verified
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setCompForm({
                          ...compForm,
                          verified: false,
                        })
                      }
                      className={`py-2 px-3 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer text-center ${
                        compForm.verified === false
                          ? "bg-slate-700 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Unverified
                    </button>
                  </div>
                </div>

                {/* Row 1: Company Name & Industry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Tech Solutions"
                      value={compForm.name ?? ""}
                      aria-label="Company name"
                      onChange={(e) =>
                        setCompForm({ ...compForm, name: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Industry
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Software Development"
                      value={compForm.industry ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, industry: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Row 2: Company Type & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Company Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Software Services / Agency"
                      value={compForm.type ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, type: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cebu IT Park, Cebu City"
                      value={compForm.location ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, location: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Row 3: Website & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Website
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. fullscale.io"
                      value={compForm.website ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, website: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. careers@company.com"
                      value={compForm.email ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, email: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Row 4: Contact Phone & Operating Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +63 32 412 8888"
                      value={compForm.phone ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, phone: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                      Office Hours
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mon – Fri, 9:00 AM – 6:00 PM"
                      value={compForm.hours ?? ""}
                      onChange={(e) =>
                        setCompForm({ ...compForm, hours: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Row 5: Target Niches & Specializations */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12.5px] font-semibold text-slate-700">
                      Target Niches / Specializations
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {(compForm.specializations || []).length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    {ALL_SPECIALIZATIONS.map((spec) => {
                      const isSelected = (
                        compForm.specializations || []
                      ).includes(spec)
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleSpec(spec)}
                          className={`text-[11.5px] font-medium px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? "bg-[#0066FF] text-white shadow-2xs"
                              : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                          }`}
                        >
                          <span>{spec}</span>
                          {isSelected && <span className="font-bold">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Row 6: Description */}
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide a clear, brief overview of the company, practicum tracks, and work culture..."
                    value={compForm.description ?? ""}
                    onChange={(e) =>
                      setCompForm({ ...compForm, description: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCompanyModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-[13.5px] font-semibold rounded-full hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13.5px] font-semibold rounded-full shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-98"
                  >
                    {companyBusy ? "Saving…" : "Save Partner"}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-[28px] sm:rounded-[32px] w-full max-w-[560px] p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[20px] font-bold text-slate-800">
                {editingCategory
                  ? "Edit Interview Category"
                  : "Add Interview Category"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              {bankError && (
                <p role="alert" className="text-red-600 text-sm">
                  {bankError}
                </p>
              )}
              <PipelineEditor value={phaseForm} onChange={setPhaseForm} />
              <div>
                <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & Machine Learning"
                  value={catForm.name}
                  onChange={(e) =>
                    setCatForm({ ...catForm, name: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                  Domain Keywords / Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. PyTorch, Transformers, LLMs, Computer Vision"
                  value={catForm.description}
                  onChange={(e) =>
                    setCatForm({ ...catForm, description: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/10 transition-all">
                    <input
                      type="color"
                      value={catForm.color}
                      onChange={(e) =>
                        setCatForm({ ...catForm, color: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg border-0 cursor-pointer p-0 bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={catForm.color}
                      onChange={(e) =>
                        setCatForm({ ...catForm, color: e.target.value })
                      }
                      className="w-full bg-transparent border-0 outline-none text-[13px] font-mono font-semibold text-slate-700 uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                    Badge Background
                  </label>
                  <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs focus-within:border-[#0066FF] focus-within:ring-2 focus-within:ring-[#0066FF]/10 transition-all">
                    <input
                      type="color"
                      value={catForm.bg}
                      onChange={(e) =>
                        setCatForm({ ...catForm, bg: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg border-0 cursor-pointer p-0 bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={catForm.bg}
                      onChange={(e) =>
                        setCatForm({ ...catForm, bg: e.target.value })
                      }
                      className="w-full bg-transparent border-0 outline-none text-[13px] font-mono font-semibold text-slate-700 uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-[13.5px] font-semibold rounded-full transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13.5px] font-semibold rounded-full shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-98"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-[28px] sm:rounded-[32px] w-full max-w-[560px] p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[20px] font-bold text-slate-700">
                {editingQuestionIdx !== null
                  ? "Edit Question"
                  : "Add New Question"}
              </h3>
              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {bankError && (
                <p role="alert" className="text-red-600">
                  {bankError}
                </p>
              )}
              <div>
                <label className="block text-[12.5px] font-semibold text-slate-700 mb-1">
                  Question Type
                </label>
                <FormSelect
                  value={questionForm.type || "Technical"}
                  options={[...QUESTION_TYPES]}
                  onChange={(val) =>
                    setQuestionForm({
                      ...questionForm,
                      type: val as Question["type"],
                      responseDefinition:
                        (MCQ_QUESTION_TYPES as readonly string[]).includes(val)
                          ? questionForm.responseDefinition
                          : { format: "written" },
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-slate-700 mb-1">
                  Question Prompt
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Type the question interviewer will ask..."
                  aria-describedby="bank-question-error"
                  value={questionForm.question}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      question: e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 rounded-xl p-3 text-[13.5px] outline-none focus:border-[#0066FF]"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-slate-700 mb-1">
                  Candidate Hint / Guidance
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Use the STAR method: Situation, Task, Action, Result..."
                  value={questionForm.hint}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, hint: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-xl p-3 text-[13.5px] outline-none focus:border-[#0066FF]"
                />
              </div>

              <QuestionResponseEditor
                type={questionForm.type}
                value={questionForm.responseDefinition}
                onChange={(responseDefinition) =>
                  setQuestionForm({
                    ...questionForm,
                    responseDefinition,
                    feedback:
                      responseDefinition.format === "multiple_choice"
                        ? ""
                        : questionForm.feedback,
                  })
                }
              />

              {questionForm.responseDefinition.format === "written" && (
                <div>
                  <label
                    htmlFor="question-rubric"
                    className="block text-[12.5px] font-semibold text-slate-700 mb-1"
                  >
                    Evaluation criteria & expected key points
                  </label>
                  <textarea
                    id="question-rubric"
                    required={questionForm.status !== "inactive"}
                    maxLength={12000}
                    rows={3}
                    placeholder="Explain what a strong response should cover for the AI to score..."
                    value={questionForm.feedback}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        feedback: e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 rounded-xl p-3 text-[13.5px] outline-none focus:border-[#0066FF]"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Required for active written questions. Describe what a good
                    answer must cover.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                  Question status
                </label>
                <FormSelect
                  value={questionForm.status ?? "active"}
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Inactive / draft", value: "inactive" },
                  ]}
                  onChange={(val) =>
                    setQuestionForm({
                      ...questionForm,
                      status: val as "active" | "inactive",
                    })
                  }
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 text-[13.5px] font-semibold rounded-full hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13.5px] font-semibold rounded-full shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/45 backdrop-blur-xs"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white rounded-[28px] sm:rounded-[32px] w-full max-w-md shadow-2xl p-5 sm:p-7 text-left border border-slate-100 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModal.type === "delete"
                    ? "bg-red-50 text-red-600 border border-red-200/60"
                    : confirmModal.type === "deactivate"
                      ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                }`}
              >
                {confirmModal.type === "delete" ? (
                  <TrashIcon size={20} />
                ) : confirmModal.type === "deactivate" ? (
                  <PowerIcon size={22} />
                ) : (
                  <CheckIcon size={22} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-[19px] font-bold text-slate-700 leading-snug">
                  {confirmModal.type === "delete"
                    ? "Remove Student from Registry"
                    : confirmModal.type === "deactivate"
                      ? `Deactivate ${
                          confirmModal.target === "company"
                            ? "Company"
                            : confirmModal.target === "category"
                              ? "Interview Category"
                              : "Question"
                        }`
                      : `Reactivate ${
                          confirmModal.target === "company"
                            ? "Company"
                            : confirmModal.target === "category"
                              ? "Interview Category"
                              : "Question"
                        }`}
                </h3>
                <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                  {confirmModal.type === "delete"
                    ? `Remove student ${confirmModal.id} from the official DCISM database?`
                    : confirmModal.type === "deactivate"
                      ? `Are you sure you want to deactivate "${confirmModal.name}"? It will be marked as inactive and can be reactivated at any time.`
                      : `Are you sure you want to reactivate "${confirmModal.name}"? It will immediately become active and available again.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-7 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-semibold rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-5 py-2.5 text-[13px] font-semibold rounded-full text-white shadow-sm transition-all cursor-pointer active:scale-98 ${
                  confirmModal.type === "delete"
                    ? "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                    : confirmModal.type === "deactivate"
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                }`}
              >
                {confirmModal.type === "delete"
                  ? "Yes, Remove"
                  : confirmModal.type === "deactivate"
                    ? "Yes, Deactivate"
                    : "Yes, Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import {
  STUDENT_COURSES,
  STUDENT_YEARS,
  type Student,
  type StudentInput,
} from "@gethired/contracts"
import { apiClient } from "@/lib/api-client"

const FilterIcon = ({
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
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
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

const CheckIcon = ({
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
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const SearchIcon = ({
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const PlusIcon = ({
  size = 16,
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
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const EditIcon = ({
  size = 12,
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

interface RegistryFilterOption {
  label: string
  value: string
}

function RegistryFilterDropdown({
  value,
  options,
  onChange,
  label = "Filter",
  placeholder,
  ariaLabel,
}: {
  value: string
  options: (string | RegistryFilterOption)[]
  onChange: (val: string) => void
  label?: string
  placeholder?: string
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

  const normalizedOptions: RegistryFilterOption[] = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt,
  )

  const selectedOpt = normalizedOptions.find((opt) => opt.value === value) || {
    label: value || placeholder || "All",
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
        <span className="truncate max-w-[200px]">{selectedOpt.label}</span>
        <ChevronDownIcon
          size={13}
          className={`transition-transform duration-200 text-slate-400 ${
            open ? "rotate-180 text-[#0066FF]" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-40 min-w-[230px] max-h-[320px] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            {label}
          </div>
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value || "__all__"}
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

export default function StudentRegistry() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState("")
  const [course, setCourse] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState<Student | "new" | null>(null)
  const lock = useRef(false)
  useEffect(() => {
    let current = true
    setLoading(true)
    setStudents([])
    setError("")
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" })
      if (search) params.set("q", search)
      if (course) params.set("course", course)
      if (status) params.set("status", status)
      void apiClient
        .list<Student>(`/api/admin/students?${params}`)
        .then((result) => {
          if (current) {
            setStudents(result.data)
            setTotal(result.meta?.total ?? 0)
          }
        })
        .catch((failure) => {
          if (current)
            setError(
              failure instanceof Error
                ? failure.message
                : "Unable to load students.",
            )
        })
        .finally(() => {
          if (current) setLoading(false)
        })
    }, 250)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [search, course, status, page, revision])
  const mutate = async (work: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await work()
      setRevision((n) => n + 1)
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to save changes.",
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const field =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
  return (
    <section className="space-y-5 pb-6">
      <div>
        <div className="inline-flex items-center gap-2 bg-[#EEF5FF] text-[#0066FF] border border-[#0066FF]/20 px-4 py-2 rounded-full text-[13px] font-medium shadow-2xs">
          <span>
            Students choose their own passwords through email verification. Add a
            pending student, then send an invitation to complete setup.
          </span>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}{" "}
          <button
            onClick={() => setRevision((n) => n + 1)}
            className="underline"
          >
            Retry loading
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <SearchIcon
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              aria-label="Search students"
              placeholder="Search name, email or student number..."
              value={search}
              maxLength={100}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full bg-white border border-slate-200 rounded-full pl-10 pr-4 py-2 text-[13px] outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all text-slate-700 placeholder:text-slate-400"
            />
          </div>

          {/* Courses Dropdown */}
          <RegistryFilterDropdown
            ariaLabel="Filter by course"
            value={course}
            placeholder="All courses"
            options={[
              { label: "All courses", value: "" },
              ...STUDENT_COURSES.map((c) => ({ label: c, value: c })),
            ]}
            onChange={(val) => {
              setCourse(val)
              setPage(1)
            }}
            label="Filter by Course"
          />

          {/* Statuses Dropdown */}
          <RegistryFilterDropdown
            ariaLabel="Filter by status"
            value={status}
            placeholder="All statuses"
            options={[
              { label: "All statuses", value: "" },
              { label: "Pending", value: "pending" },
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ]}
            onChange={(val) => {
              setStatus(val)
              setPage(1)
            }}
            label="Filter by Status"
          />
        </div>

        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 bg-[#0066FF] hover:bg-[#0052cc] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-98 shrink-0"
        >
          <PlusIcon size={16} />
          <span>Add student</span>
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                "Student number",
                "Name / email",
                "Course / year",
                "Status",
                "Actions",
              ].map((label) => (
                <th className="p-4" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-t border-slate-100">
                <td className="p-4 font-mono">{student.studentNumber}</td>
                <td className="p-4">
                  <p className="font-semibold">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-slate-500">{student.email}</p>
                </td>
                <td className="p-4">
                  {student.course}
                  <p className="text-slate-500">{student.yearLevel}</p>
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize border ${
                      student.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                        : student.status === "pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200/80"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {student.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing(student)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#EEF5FF] text-[#0066FF] hover:bg-[#0066FF] hover:text-white border border-[#0066FF]/20 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-40"
                    >
                      <EditIcon size={12} />
                      <span>Edit</span>
                    </button>
                    {student.status === "pending" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(async () => {
                            const result = await apiClient.mutate<{
                              message: string
                            }>(
                              `/api/admin/students/${student.id}/invitations`,
                              "POST",
                              {},
                            )
                            setNotice(result.message)
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-blue-50 text-blue-700 hover:bg-[#0066FF] hover:text-white border border-blue-200 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-40"
                      >
                        <span>Send invitation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(async () => {
                            await apiClient.mutate(
                              `/api/admin/students/${student.id}`,
                              "PATCH",
                              {
                                status:
                                  student.status === "active"
                                    ? "inactive"
                                    : "active",
                              },
                            )
                            setNotice(
                              student.status === "active"
                                ? "Student deactivated. Existing sessions have been revoked."
                                : "Student reactivated. A fresh sign-in is required.",
                            )
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-40 ${
                          student.status === "active"
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200/80"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200/80"
                        }`}
                      >
                        <span>
                          {student.status === "active"
                            ? "Deactivate"
                            : "Reactivate"}
                        </span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  {loading
                    ? "Loading students…"
                    : error
                      ? "Students could not be loaded."
                      : "No students match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>
          {total} students · Page {page}
        </span>
        <div className="flex gap-3">
          <button
            disabled={loading || page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={loading || page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-form-title"
            className="my-auto w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl"
          >
            <h2 id="student-form-title" className="mb-5 text-xl font-semibold">
              {editing === "new" ? "Add pending student" : "Edit student"}
            </h2>
            {error && (
              <p role="alert" className="mb-4 text-sm text-red-700">
                {error}
              </p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                const input = {
                  firstName: String(form.get("firstName")),
                  lastName: String(form.get("lastName")),
                  course: form.get("course"),
                  yearLevel: form.get("yearLevel"),
                }
                void mutate(async () => {
                  if (editing === "new")
                    await apiClient.mutate<Student>(
                      "/api/admin/students",
                      "POST",
                      {
                        ...input,
                        email: String(form.get("email")),
                      } as StudentInput,
                    )
                  else
                    await apiClient.mutate(
                      `/api/admin/students/${editing.id}`,
                      "PATCH",
                      input,
                    )
                  setEditing(null)
                  setNotice(
                    editing === "new"
                      ? "Student added. Send an invitation to complete setup."
                      : "Student updated.",
                  )
                })
              }}
            >
              <fieldset disabled={busy} className="space-y-4">
                <label className="block text-sm">
                  First name
                  <input
                    name="firstName"
                    required
                    maxLength={100}
                    defaultValue={editing === "new" ? "" : editing.firstName}
                    className={`${field} mt-1 w-full`}
                  />
                </label>
                <label className="block text-sm">
                  Last name
                  <input
                    name="lastName"
                    required
                    maxLength={100}
                    defaultValue={editing === "new" ? "" : editing.lastName}
                    className={`${field} mt-1 w-full`}
                  />
                </label>
                {editing === "new" ? (
                  <label className="block text-sm">
                    USC student email
                    <input
                      name="email"
                      type="email"
                      pattern="[0-9]{8}@usc\.edu\.ph"
                      required
                      placeholder="12345678@usc.edu.ph"
                      className={`${field} mt-1 w-full`}
                    />
                  </label>
                ) : (
                  <p className="text-sm text-slate-500">
                    {editing.email} · {editing.studentNumber}
                  </p>
                )}
                <label className="block text-sm font-semibold text-slate-700">
                  Course
                  <select
                    name="course"
                    defaultValue={
                      editing === "new" ? STUDENT_COURSES[0] : editing.course
                    }
                    className={`${field} mt-1 w-full bg-white text-slate-700 cursor-pointer`}
                  >
                    {STUDENT_COURSES.map((value) => (
                      <option key={value} value={value} className="bg-white text-slate-700">
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Year level
                  <select
                    name="yearLevel"
                    defaultValue={
                      editing === "new" ? STUDENT_YEARS[0] : editing.yearLevel
                    }
                    className={`${field} mt-1 w-full bg-white text-slate-700 cursor-pointer`}
                  >
                    {STUDENT_YEARS.map((value) => (
                      <option key={value} value={value} className="bg-white text-slate-700">
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-4 pt-3">
                  <button type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-2 text-white"
                  >
                    {busy ? "Saving…" : "Save student"}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

"use client"
import { QUESTION_TYPES, type PhaseConfig } from "@gethired/contracts"

const ArrowUpIcon = ({ size = 12 }: { size?: number }) => (
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
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
)

const TrashIcon = ({ size = 12 }: { size?: number }) => (
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

const PlusIcon = ({ size = 14 }: { size?: number }) => (
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

export default function PipelineEditor({
  value,
  onChange,
}: {
  value: PhaseConfig[]
  onChange: (value: PhaseConfig[]) => void
}) {
  const update = (index: number, patch: Partial<PhaseConfig>) =>
    onChange(
      value.map((phase, i) => (i === index ? { ...phase, ...patch } : phase)),
    )

  return (
    <fieldset className="space-y-3.5">
      <div>
        <legend className="text-[13.5px] font-bold text-slate-800">
          Interview phases, in order
        </legend>
        <p className="text-[12px] text-slate-500 mt-0.5">
          Add enough active questions for each phase. A question type can belong
          to one phase only.
        </p>
      </div>

      <div className="space-y-3">
        {value.map((phase, index) => (
          <div
            key={phase.id}
            className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-3 transition-all"
          >
            {/* Header: Phase badge & action controls */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-white border border-slate-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                Phase {index + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...value]
                    ;[next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ]
                    onChange(next)
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#0066FF] hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                  title="Move phase up"
                >
                  <ArrowUpIcon size={11} />
                  <span>Move up</span>
                </button>
                <button
                  type="button"
                  disabled={value.length === 1}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                  title="Remove phase"
                >
                  <TrashIcon size={11} />
                  <span>Remove phase</span>
                </button>
              </div>
            </div>

            {/* Inputs: Phase Name & Question Count */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-3">
                <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
                  Phase name
                </label>
                <input
                  aria-label={`Phase ${index + 1} name`}
                  required
                  maxLength={80}
                  value={phase.label}
                  onChange={(e) =>
                    update(index, {
                      label: e.target.value,
                      shortLabel: e.target.value,
                    })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all placeholder:text-slate-400"
                  placeholder="e.g. Introduction"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">
                  Questions
                </label>
                <input
                  aria-label={`Phase ${index + 1} count`}
                  type="number"
                  min={1}
                  max={5}
                  required
                  value={phase.count}
                  onChange={(e) =>
                    update(index, { count: Number(e.target.value) })
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-700 text-center outline-none focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/10 transition-all"
                />
              </div>
            </div>

            {/* Types Selection as Interactive Pill Chips */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Allowed Question Types
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_TYPES.map((type) => {
                  const isChecked = phase.types.includes(type)
                  const isDisabled =
                    !isChecked && value.some((p) => p.types.includes(type))

                  return (
                    <label
                      key={type}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-all select-none ${
                        isDisabled
                          ? "bg-slate-100/70 text-slate-300 border-slate-200/50 cursor-not-allowed line-through opacity-60"
                          : isChecked
                            ? "bg-[#EEF5FF] text-[#0066FF] border-[#0066FF] font-semibold cursor-pointer shadow-2xs"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) =>
                          update(index, {
                            types: e.target.checked
                              ? [...phase.types, type]
                              : phase.types.filter((t) => t !== type),
                          })
                        }
                      />
                      <span>{type}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={value.length >= 8}
        className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#0066FF] text-[#0066FF] hover:bg-blue-50/50 text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => {
          let id = "phase"
          while (value.some((p) => p.id === id)) id += "-new"
          onChange([
            ...value,
            {
              id,
              label: "New phase",
              shortLabel: "New phase",
              types: [],
              count: 1,
            },
          ])
        }}
      >
        <PlusIcon size={14} />
        <span>Add phase</span>
      </button>
    </fieldset>
  )
}

"use client";

import { MCQ_QUESTION_TYPES, QUESTION_OPTION_LIMITS, type QuestionResponseDefinition, type QuestionType } from "@gethired/contracts";

interface Props {
  type: QuestionType;
  value: QuestionResponseDefinition;
  onChange: (value: QuestionResponseDefinition) => void;
}

export default function QuestionResponseEditor({ type, value, onChange }: Props) {
  const allowsMcq = (MCQ_QUESTION_TYPES as readonly string[]).includes(type);
  return (
    <div className="space-y-3">
      <label className="block text-[12.5px] font-semibold text-slate-700">
        Answer format
        <select
          aria-label="Answer format"
          value={value.format}
          onChange={event => onChange(event.target.value === "written" ? { format: "written" } : {
            format: "multiple_choice",
            options: ["a", "b", "c", "d"].map(id => ({ id, text: "" })),
            correctOptionId: "",
          })}
          className="mt-1 block w-full rounded-xl border border-slate-200 p-3 text-[13.5px]"
        >
          <option value="written">Written response</option>
          <option value="multiple_choice" disabled={!allowsMcq}>Multiple choice</option>
        </select>
      </label>
      <p className="text-xs text-slate-500">
        {type === "Coding"
          ? value.format === "multiple_choice"
            ? "Use code tracing, debugging, or similar questions with one correct choice."
            : "Ask for a solution and an explanation of the reasoning behind it."
          : !allowsMcq ? "This question type uses a written response." : "Choose a written response or a single correct choice."}
      </p>
      {value.format === "multiple_choice" && (
        <fieldset className="space-y-3">
          <legend className="text-[12.5px] font-semibold text-slate-700">Choices and correct answer</legend>
          <p className="text-xs text-slate-500">Add 2–6 distinct choices and select one correct answer. No explanation is collected.</p>
          {value.options.map((option, index) => (
            <div key={option.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
              <input
                type="radio" name="correct-option" required
                aria-label={`Mark option ${index + 1} correct`}
                checked={value.correctOptionId === option.id}
                onChange={() => onChange({ ...value, correctOptionId: option.id })}
                className="mt-3 accent-[#0066FF]"
              />
              <label className="min-w-0 flex-1 text-xs text-slate-500">
                Option {index + 1}
                <textarea
                  required maxLength={QUESTION_OPTION_LIMITS.text} rows={2}
                  aria-label={`Option ${index + 1}`}
                  value={option.text}
                  onChange={event => onChange({ ...value, options: value.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })}
                  className={`mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm text-slate-800 ${type === "Coding" ? "font-mono" : ""}`}
                />
              </label>
              <button
                type="button" aria-label={`Remove option ${index + 1}`}
                disabled={value.options.length <= QUESTION_OPTION_LIMITS.min}
                onClick={() => onChange({ ...value, options: value.options.filter(item => item.id !== option.id), correctOptionId: value.correctOptionId === option.id ? "" : value.correctOptionId })}
                className="mt-2 text-xs text-slate-500 hover:text-red-600 disabled:opacity-30"
              >Remove</button>
            </div>
          ))}
          <button
            type="button" disabled={value.options.length >= QUESTION_OPTION_LIMITS.max}
            onClick={() => onChange({ ...value, options: [...value.options, { id: `o${crypto.randomUUID()}`, text: "" }] })}
            className="text-sm font-semibold text-[#0066FF] disabled:opacity-40"
          >Add choice</button>
        </fieldset>
      )}
    </div>
  );
}

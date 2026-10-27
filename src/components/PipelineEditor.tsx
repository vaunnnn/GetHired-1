"use client";
import { QUESTION_TYPES, type PhaseConfig } from "@gethired/contracts";

export default function PipelineEditor({ value, onChange }: { value: PhaseConfig[]; onChange: (value: PhaseConfig[]) => void }) {
  const update = (index: number, patch: Partial<PhaseConfig>) => onChange(value.map((phase, i) => i === index ? { ...phase, ...patch } : phase));
  return <fieldset className="space-y-3">
    <legend className="text-sm font-semibold">Interview phases, in order</legend>
    <p className="text-xs text-slate-500">Add enough active questions for each phase. A question type can belong to one phase only.</p>
    {value.map((phase, index) => <div key={phase.id} className="rounded-xl border p-3 space-y-2">
      <div className="flex gap-2">
        <label className="flex-1 text-xs">Phase name<input aria-label={`Phase ${index + 1} name`} required maxLength={80} value={phase.label} onChange={e => update(index, { label: e.target.value, shortLabel: e.target.value })} className="w-full border rounded p-1" /></label>
        <label className="text-xs">Questions<input aria-label={`Phase ${index + 1} count`} type="number" min={1} max={5} required value={phase.count} onChange={e => update(index, { count: Number(e.target.value) })} className="block w-16 border rounded p-1" /></label>
      </div>
      <div className="flex flex-wrap gap-2">{QUESTION_TYPES.map(type => <label key={type} className="text-xs"><input type="checkbox" checked={phase.types.includes(type)} disabled={!phase.types.includes(type) && value.some(p => p.types.includes(type))} onChange={e => update(index, { types: e.target.checked ? [...phase.types, type] : phase.types.filter(t => t !== type) })} /> {type}</label>)}</div>
      <div className="flex gap-3 text-xs">
        <button type="button" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>Move up</button>
        <button type="button" disabled={value.length === 1} onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove phase</button>
      </div>
    </div>)}
    <button type="button" disabled={value.length >= 8} className="text-sm text-blue-600" onClick={() => {
      let id = "phase"; while (value.some(p => p.id === id)) id += "-new";
      onChange([...value, { id, label: "New phase", shortLabel: "New phase", types: [], count: 1 }]);
    }}>Add phase</button>
  </fieldset>;
}

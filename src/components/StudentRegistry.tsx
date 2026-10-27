"use client";

import { useEffect, useRef, useState } from "react";
import { STUDENT_COURSES, STUDENT_YEARS, type Student, type StudentInput } from "@gethired/contracts";
import { apiClient } from "@/lib/api-client";

export default function StudentRegistry() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setStudents([]); setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("q", search);
      if (course) params.set("course", course);
      if (status) params.set("status", status);
      void apiClient.list<Student>(`/api/admin/students?${params}`).then(result => {
        if (current) { setStudents(result.data); setTotal(result.meta?.total ?? 0); }
      }).catch(failure => { if (current) setError(failure instanceof Error ? failure.message : "Unable to load students."); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [search, course, status, page, revision]);
  const mutate = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await work(); setRevision(n => n + 1); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save changes."); }
    finally { lock.current = false; setBusy(false); }
  };
  const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
  return <section className="space-y-5 overflow-auto pb-6">
    <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">Students choose their own passwords through email verification. Add a pending student, then send an invitation to complete setup.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error} <button onClick={() => setRevision(n => n + 1)} className="underline">Retry loading</button></p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{notice}</p>}
    <div className="flex flex-wrap gap-3">
      <input aria-label="Search students" placeholder="Search name, email or student number" value={search} maxLength={100} onChange={e => { setSearch(e.target.value); setPage(1); }} className={`${field} min-w-64 flex-1`} />
      <select aria-label="Filter by course" value={course} onChange={e => { setCourse(e.target.value); setPage(1); }} className={field}><option value="">All courses</option>{STUDENT_COURSES.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={field}><option value="">All statuses</option>{["pending", "active", "inactive"].map(value => <option key={value}>{value}</option>)}</select>
      <button onClick={() => setEditing("new")} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white">Add student</button>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Student number", "Name / email", "Course / year", "Status", "Actions"].map(label => <th className="p-4" key={label}>{label}</th>)}</tr></thead>
        <tbody>{students.map(student => <tr key={student.id} className="border-t border-slate-100"><td className="p-4 font-mono">{student.studentNumber}</td><td className="p-4"><p className="font-semibold">{student.firstName} {student.lastName}</p><p className="text-slate-500">{student.email}</p></td><td className="p-4">{student.course}<p className="text-slate-500">{student.yearLevel}</p></td><td className="p-4 capitalize">{student.status}</td><td className="p-4"><div className="flex flex-wrap gap-3">
          <button disabled={busy} onClick={() => setEditing(student)} className="text-blue-600">Edit</button>
          {student.status === "pending" ? <button disabled={busy} onClick={() => void mutate(async () => {
            const result = await apiClient.mutate<{ message: string }>(`/api/admin/students/${student.id}/invitations`, "POST", {}); setNotice(result.message);
          })} className="text-blue-600">Send invitation</button> : <button disabled={busy} onClick={() => void mutate(async () => {
            await apiClient.mutate(`/api/admin/students/${student.id}`, "PATCH", { status: student.status === "active" ? "inactive" : "active" });
            setNotice(student.status === "active" ? "Student deactivated. Existing sessions have been revoked." : "Student reactivated. A fresh sign-in is required.");
          })} className="text-slate-600">{student.status === "active" ? "Deactivate" : "Reactivate"}</button>}
        </div></td></tr>)}{!students.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">{loading ? "Loading students…" : error ? "Students could not be loaded." : "No students match your search."}</td></tr>}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-between text-sm"><span>{total} students · Page {page}</span><div className="flex gap-3"><button disabled={loading || page === 1} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">Previous</button><button disabled={loading || page * 20 >= total} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next</button></div></div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-5"><section role="dialog" aria-modal="true" aria-labelledby="student-form-title" className="my-auto w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl">
      <h2 id="student-form-title" className="mb-5 text-xl font-semibold">{editing === "new" ? "Add pending student" : "Edit student"}</h2>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      <form onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        const input = { firstName: String(form.get("firstName")), lastName: String(form.get("lastName")), course: form.get("course"), yearLevel: form.get("yearLevel") };
        void mutate(async () => {
          if (editing === "new") await apiClient.mutate<Student>("/api/admin/students", "POST", { ...input, email: String(form.get("email")) } as StudentInput);
          else await apiClient.mutate(`/api/admin/students/${editing.id}`, "PATCH", input);
          setEditing(null); setNotice(editing === "new" ? "Student added. Send an invitation to complete setup." : "Student updated.");
        });
      }}><fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm">First name<input name="firstName" required maxLength={100} defaultValue={editing === "new" ? "" : editing.firstName} className={`${field} mt-1 w-full`} /></label>
        <label className="block text-sm">Last name<input name="lastName" required maxLength={100} defaultValue={editing === "new" ? "" : editing.lastName} className={`${field} mt-1 w-full`} /></label>
        {editing === "new" ? <label className="block text-sm">USC student email<input name="email" type="email" pattern="[0-9]{8}@usc\.edu\.ph" required placeholder="12345678@usc.edu.ph" className={`${field} mt-1 w-full`} /></label> : <p className="text-sm text-slate-500">{editing.email} · {editing.studentNumber}</p>}
        <label className="block text-sm">Course<select name="course" defaultValue={editing === "new" ? STUDENT_COURSES[0] : editing.course} className={`${field} mt-1 w-full`}>{STUDENT_COURSES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="block text-sm">Year level<select name="yearLevel" defaultValue={editing === "new" ? STUDENT_YEARS[0] : editing.yearLevel} className={`${field} mt-1 w-full`}>{STUDENT_YEARS.map(value => <option key={value}>{value}</option>)}</select></label>
        <div className="flex justify-end gap-4 pt-3"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="rounded-xl bg-blue-600 px-5 py-2 text-white">{busy ? "Saving…" : "Save student"}</button></div>
      </fieldset></form>
    </section></div>}
  </section>;
}

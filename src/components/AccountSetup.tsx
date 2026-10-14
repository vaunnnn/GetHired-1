"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STUDENT_COURSES, STUDENT_YEARS, type ChallengeResponse } from "@gethired/contracts";
import { apiClient } from "@/lib/api-client";

export default function AccountSetup({ mode }: { mode: "signup" | "recovery" | "invite" }) {
  const [step, setStep] = useState<"details" | "code" | "password" | "done">(mode === "invite" ? "password" : "details");
  const [challengeId, setChallengeId] = useState("");
  const [tokenHash, setTokenHash] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const invitationRead = useRef(false);
  const requestLock = useRef(false);
  useEffect(() => {
    if (mode !== "invite" || invitationRead.current) return;
    invitationRead.current = true;
    const proof = new URLSearchParams(window.location.hash.slice(1)).get("token_hash") ?? "";
    setTokenHash(proof);
    window.history.replaceState(null, "", window.location.pathname);
    if (!/^[a-f0-9]{56}$/.test(proof)) setError("This invitation is missing or invalid. Ask your coordinator for a new invitation.");
  }, [mode]);
  const run = async (work: () => Promise<void>) => {
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true); setError("");
    try { await work(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { requestLock.current = false; setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(async () => {
      if (step === "details") {
        const result = await apiClient.mutate<ChallengeResponse>(mode === "signup" ? "/api/auth/signup" : "/api/auth/password-reset/request", "POST",
          mode === "signup" ? { email, password, firstName: form.get("firstName"), lastName: form.get("lastName"), course: form.get("course"), yearLevel: form.get("yearLevel") } : { email });
        setChallengeId(result.challengeId); setMessage(result.message); setStep("code");
      } else if (step === "code") {
        await apiClient.mutate(mode === "signup" ? "/api/auth/signup/verify" : "/api/auth/password-reset/verify", "POST",
          { challengeId, code, ...(mode === "signup" ? { newPassword: password } : {}) });
        setCode(""); setMessage("");
        if (mode === "signup") { setPassword(""); setStep("done"); } else setStep("password");
      } else {
        await apiClient.mutate(mode === "invite" ? "/api/auth/invitations/accept" : "/api/auth/password-reset/complete", "POST",
          { newPassword: password, ...(mode === "invite" ? { tokenHash } : {}) });
        setPassword(""); setTokenHash(""); setMessage(""); setStep("done");
      }
    });
  };
  const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-blue-600";
  const heading = step === "done" ? "You're ready to sign in" : mode === "signup" ? "Create your student account" : mode === "invite" ? "Accept your invitation" : "Reset your password";
  return <main className="min-h-screen bg-slate-50 px-6 py-14 text-slate-800">
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
      <Link href="/login" className="text-sm font-medium text-blue-600">← Back to sign in</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{heading}</h1>
      {step === "done" ? <div className="mt-6 space-y-6"><p>{mode === "recovery" ? "Your password has been updated and all devices have been signed out." : "Your account is active. Sign in with your email or student number and your chosen password."}</p><Link href="/login" className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-white">Sign in</Link></div> :
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            {step === "details" && <>
              {mode === "signup" && <><p className="text-sm text-slate-600">Use your eight-digit USC student email. Your account becomes active after email verification.</p>
                <label className="block text-sm font-medium">First name<input name="firstName" autoComplete="given-name" required maxLength={100} className={fieldClass} /></label>
                <label className="block text-sm font-medium">Last name<input name="lastName" autoComplete="family-name" required maxLength={100} className={fieldClass} /></label>
                <label className="block text-sm font-medium">Course<select name="course" className={fieldClass}>{STUDENT_COURSES.map(course => <option key={course}>{course}</option>)}</select></label>
                <label className="block text-sm font-medium">Year level<select name="yearLevel" className={fieldClass}>{STUDENT_YEARS.map(year => <option key={year}>{year}</option>)}</select></label></>}
              <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} pattern={mode === "signup" ? "[0-9]{8}@usc\\.edu\\.ph" : undefined} value={email} onChange={e => setEmail(e.target.value.toLowerCase())} placeholder={mode === "signup" ? "12345678@usc.edu.ph" : "Your account email"} className={fieldClass} /></label>
            </>}
            {(step === "password" || step === "details" && mode === "signup") && <label className="block text-sm font-medium">{mode === "signup" ? "Password" : "New password"}<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} className={fieldClass} /><span className="mt-1 block text-xs text-slate-500">Use 12–128 characters.</span></label>}
            {step === "code" && <label className="block text-sm font-medium">Email verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code} onChange={e => setCode(e.target.value)} className={fieldClass} /><span className="mt-1 block text-xs text-slate-500">Use the newest code. Keep this tab open while you check your email.</span></label>}
            <button type="submit" disabled={mode === "invite" && !tokenHash} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : step === "code" ? "Verify email" : step === "password" ? "Set password" : "Send verification code"}</button>
            {step === "code" && <button type="button" className="w-full text-sm text-blue-600" onClick={() => void run(async () => {
              const result = await apiClient.mutate<ChallengeResponse>(mode === "signup" ? "/api/auth/signup/resend" : "/api/auth/password-reset/request", "POST", mode === "signup" ? { challengeId } : { email });
              setChallengeId(result.challengeId); setCode(""); setMessage(result.message);
            })}>Send a new code</button>}
            {mode !== "invite" && step !== "details" && <button type="button" onClick={() => { setStep("details"); setPassword(""); setCode(""); setMessage(""); setError(""); }} className="w-full text-sm text-slate-600">Start again</button>}
          </fieldset>
        </form>}
    </div>
  </main>;
}

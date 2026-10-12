import Link from "next/link";

export default function Signup() {
  return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-2xl font-semibold">Registration is not available yet</h1>
    <p>Account registration and email verification are coming soon. Contact your coordinator for access.</p>
    <Link href="/login" className="rounded-xl bg-blue-600 px-5 py-3 text-white">Back to sign in</Link>
  </main>;
}

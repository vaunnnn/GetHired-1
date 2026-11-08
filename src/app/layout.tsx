import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "GetHired - DCISM Practicum & Career Platform",
  description:
    "Browse verified DCISM industry partners, save your top picks, and prepare with AI mock interviews.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen font-sans text-slate-700">
        {children}
      </body>
    </html>
  )
}

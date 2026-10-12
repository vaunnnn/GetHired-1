export interface Company {
  id: string
  name: string
  industry: string
  type: string
  specializations: string[]
  location: string
  slots: number
  description: string
  image: string
  website: string
  email: string
  phone: string
  hours: string
  status: "active" | "inactive"
}
export type CompanyInput = Omit<Company, "id" | "image" | "status"> & { imageId?: string | null; status?: Company["status"] }
export interface Bookmark { companyId: string; createdAt: string; company: Company }
export const COMPANY_SPECIALIZATIONS = ["Software Dev", "React / Node.js", "Web Development", "Mobile Development", "Data Analytics", "Machine Learning", "Cybersecurity", "Cloud Computing", "DevOps", "AI", "Automation", "UI/UX Design", "IT Consulting", "BPO", "Telecommunications", "FinTech", "Blockchain", "Network Engineering", "IT Support", "QA / Testing", "Database Management"] as const
export const COMPANY_NICHES: Record<string, { industry?: string; pattern?: string }> = {
  "All": {},
  "Web Development": { pattern: "web|react|node" },
  "Mobile Development": { pattern: "mobile" },
  "Data Science": { pattern: "data|analytics|machine learning" },
  "Cybersecurity": { industry: "Cybersecurity", pattern: "security|penetration|threat" },
  "Cloud & DevOps": { pattern: "cloud|devops" },
  "AI / ML": { pattern: "ai|ml|machine|automation" },
  "UI/UX Design": { pattern: "ui|ux|design" },
  "IT Consulting": { industry: "IT Consulting" },
  "BPO": { industry: "BPO" },
  "Telecommunications": { industry: "Telecommunications" },
  "Banking / FinTech": { industry: "Banking / FinTech", pattern: "fintech|blockchain" },
  "Software Dev": { industry: "Software Development", pattern: "software" },
  "Network Engineering": { pattern: "network" },
  "IT Support": { pattern: "helpdesk|support" },
}
export const COMPANY_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const COMPANY_MULTIPART_MAX_BYTES = COMPANY_IMAGE_MAX_BYTES + 16 * 1024

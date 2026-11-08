import type { Company as CompanyDto } from "@gethired/contracts"
export type Company = CompanyDto & {
  saved: boolean
  deactivated: boolean
  verified?: boolean
  verified_on?: string
}
export const companyView = (company: CompanyDto, saved = false): Company => ({
  ...company,
  saved,
  deactivated: company.status === "inactive",
  verified: (company as any).verified ?? true,
  verified_on: (company as any).verified_on ?? "Oct 24, 2026",
})

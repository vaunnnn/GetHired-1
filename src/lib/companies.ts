import type { Company as CompanyDto } from "@gethired/contracts"
export type Company = CompanyDto & {
  saved: boolean
  deactivated: boolean
  verified: boolean
  verified_on?: string
}
export const companyView = (company: CompanyDto, saved = false): Company => {
  const verified = company.verified !== false
  return {
    ...company,
    saved,
    deactivated: company.status === "inactive",
    verified,
    verified_on: verified ? company.verified_on || "Oct 24, 2026" : undefined,
  }
}

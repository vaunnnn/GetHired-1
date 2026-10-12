import type { Company as CompanyDto } from "@gethired/contracts";
export type Company = CompanyDto & { saved: boolean; deactivated: boolean };
export const companyView = (company: CompanyDto, saved = false): Company => ({ ...company, saved, deactivated: company.status === "inactive" });

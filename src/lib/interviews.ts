import { apiClient } from "./api-client";
import type { Category, Question } from "@gethired/contracts";
export type InterviewCategory = Category & { deactivated?: boolean };
export type InterviewQuestion = Omit<Question, "id" | "status"> & { id?: string; status?: "active" | "inactive"; deactivated?: boolean };
export const categoryView = (c: Category): InterviewCategory => ({ ...c, deactivated: c.status === "inactive" });
export const questionView = (q: Question): InterviewQuestion => ({ ...q, deactivated: q.status === "inactive" });
export async function bankList<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await apiClient.list<T>(`${path}?page=${page}&pageSize=100`);
    items.push(...result.data);
    if (!result.data.length || items.length >= (result.meta?.total ?? items.length)) return items;
  }
}

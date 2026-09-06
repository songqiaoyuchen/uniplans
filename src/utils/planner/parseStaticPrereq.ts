import { PrereqTree } from "@/types/plannerTypes";
import { parsePrerequisite } from "@/utils/prerequisites/parsePrerequisite";

/**
 * Parse prerequisite data from static JSON format to PrereqTree format
 * @param data - The prerequisite data from modulePrereqInfo.json
 * @returns PrereqTree or null if no prerequisites
 */
export function parseStaticPrereq(data: unknown): PrereqTree | null {
  // Handle string (single module code)
  // Remove grade suffix (e.g., ":D") if present
  // Handle AND logic
  // Handle OR logic
  // Handle N-OF logic
  // Keep NOF wrapper even with 1 child to show "at least N of" requirement
  return parsePrerequisite(data ?? null);
}

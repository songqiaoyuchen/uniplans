export function cohortYearBounds(years: readonly string[]): { start: number; end: number } {
  if (!Array.isArray(years) || years.length < 1 || years.length > 2) {
    throw new Error("Cohort years must contain one bound or an S/E interval.");
  }
  let start = -Infinity;
  let end = Infinity;
  const seen = new Set<string>();
  for (const token of years) {
    const match = typeof token === "string" ? /^([SE]):([1-9]\d{3})(?:\/(\d{2}))?$/.exec(token) : null;
    if (!match) throw new Error(`Unsupported cohort year encoding: ${String(token)}.`);
    const [, bound, yearText, nextYearText] = match;
    const year = Number(yearText);
    if (nextYearText !== undefined && Number(nextYearText) !== (year + 1) % 100) {
      throw new Error(`Invalid academic year: ${token}.`);
    }
    if (seen.has(bound)) throw new Error(`Duplicate cohort ${bound} bound.`);
    seen.add(bound);
    if (bound === "S") start = year;
    else end = year;
  }
  if (start > end) throw new Error("Cohort interval starts after it ends.");
  return { start, end };
}

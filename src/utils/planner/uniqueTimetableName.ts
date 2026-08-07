export function uniqueTimetableName(
  requestedName: string,
  existingNames: Iterable<string>,
  currentName?: string,
): string {
  if (requestedName === currentName) return requestedName;

  const taken = new Set(existingNames);
  if (currentName) taken.delete(currentName);
  if (!taken.has(requestedName)) return requestedName;

  let suffix = 2;
  while (taken.has(`${requestedName} (${suffix})`)) suffix += 1;
  return `${requestedName} (${suffix})`;
}

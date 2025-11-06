export function splitIntoSmsSegments(text: string, limit = 5): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, limit);
}



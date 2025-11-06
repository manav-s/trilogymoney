export function splitIntoSmsSegments(text: string, limit = 5): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
    })
    .filter(Boolean)
    .slice(0, limit);
}



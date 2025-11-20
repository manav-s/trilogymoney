export function splitIntoSmsSegments(text: string, limit = 5): string[] {
  // First, split by newlines to preserve explicit formatting (like lists)
  const lines = text.split('\n');
  const segments: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // If it looks like a numbered list item (e.g. "1. Item"), keep it whole
    if (/^\d+\./.test(trimmed)) {
      segments.push(trimmed);
      continue;
    }

    // Otherwise, split by sentence boundaries
    // Lookbehind for [.!?] followed by whitespace
    const parts = trimmed.split(/(?<=[.!?])\s+/);

    for (const part of parts) {
      const p = part.trim();
      if (p) segments.push(p);
    }
  }

  return segments.slice(0, limit);
}



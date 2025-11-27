export function splitIntoSmsSegments(text: string, limit = 20): string[] {
  // Split on double newlines (blank lines) to separate logical sections
  // Single newlines within a section (like bullet lists) stay together
  const sections = text.split(/\n\s*\n+/);
  const segments: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    segments.push(trimmed);
  }

  return segments.slice(0, limit);
}



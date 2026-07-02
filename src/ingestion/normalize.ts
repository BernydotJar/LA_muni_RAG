export const normalizeLineEndings = (value: string): string =>
  value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u0000/g, "");

export const normalizeWhitespace = (value: string): string => {
  const lines = normalizeLineEndings(value)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));

  const compactLines: string[] = [];
  let previousBlank = false;

  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    if (isBlank && previousBlank) continue;
    compactLines.push(line);
    previousBlank = isBlank;
  }

  return compactLines.join("\n").trim();
};

export const contentToText = (content: string | Buffer): string =>
  typeof content === "string" ? content : content.toString("utf-8");

export const detectArticleNumber = (value: string): string | null => {
  const match = value.match(/^\s*(?:art(?:i|í)culo|art\.)\s+([0-9]+[A-Za-z-]*)/i);
  return match?.[1] ?? null;
};

export const isLikelyHeading = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (detectArticleNumber(trimmed)) return true;
  if (/^[0-9]+(?:\.[0-9]+)*[.)]?\s+\S+/.test(trimmed)) return true;
  if (trimmed.length <= 90 && /^[A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9\s,.;:()/-]+$/.test(trimmed)) {
    return true;
  }
  return false;
};

export const stripMarkdownInline = (value: string): string =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();

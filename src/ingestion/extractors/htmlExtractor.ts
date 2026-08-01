import { buildCitationLabel } from "../citation.js";
import { contentToText, detectArticleNumber, normalizeWhitespace } from "../normalize.js";
import type { DocumentExtractor, ExtractorInput, NormalizedDocument, NormalizedSection } from "../types.js";

interface HeadingState {
  level: number;
  title: string;
}

interface SectionDraft {
  heading: string | null;
  sectionPath: string[];
  textLines: string[];
  ordinal: number;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&#([0-9]+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&([A-Za-z][A-Za-z0-9]+);/g, (match, name: string) => NAMED_ENTITIES[name] ?? match);

const stripTags = (value: string): string =>
  decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

const htmlToMarkedText = (html: string): string => {
  let value = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<!DOCTYPE[^>]*>/gi, " ")
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");

  value = value.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi, (_match, level: string, inner: string) => {
    const heading = stripTags(inner);
    return heading ? `\n@@HTML_HEADING:${level}:${heading}\n` : "\n";
  });

  value = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(?:p|div|li|ul|ol|tr|table|section|article|header|footer|main|aside|dl|dt|dd)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");

  return normalizeWhitespace(decodeEntities(value));
};

const sectionFromDraft = (title: string, draft: SectionDraft): NormalizedSection | null => {
  const text = normalizeWhitespace(draft.textLines.join("\n"));
  if (!text && !draft.heading) return null;

  const heading = draft.heading ?? title;
  const articleNumber = detectArticleNumber(heading);
  const sectionPath = draft.sectionPath.length > 0 ? draft.sectionPath : [heading];

  return {
    heading,
    sectionType: articleNumber ? "article" : draft.heading ? "heading" : "section",
    sectionPath,
    text: text || heading,
    pageStart: null,
    pageEnd: null,
    articleNumber,
    citationLabel: buildCitationLabel({ title, sectionPath, heading, articleNumber }),
    metadata: {
      ordinal: draft.ordinal,
      extractor: "html_heading_v1",
    },
  };
};

export const htmlExtractor: DocumentExtractor = {
  sourceFormat: "html",

  extract(input: ExtractorInput): NormalizedDocument {
    const markedText = htmlToMarkedText(contentToText(input.content));
    const lines = markedText.split("\n");
    const headingStack: HeadingState[] = [];
    const sections: NormalizedSection[] = [];
    let ordinal = 0;
    let current: SectionDraft = {
      heading: null,
      sectionPath: [],
      textLines: [],
      ordinal,
    };

    const flush = (): void => {
      const section = sectionFromDraft(input.title, current);
      if (section) sections.push(section);
    };

    for (const line of lines) {
      const match = line.match(/^@@HTML_HEADING:([1-6]):(.+)$/);
      if (match) {
        flush();
        ordinal += 1;
        const level = Number(match[1]);
        const heading = match[2].trim();
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }
        headingStack.push({ level, title: heading });
        current = {
          heading,
          sectionPath: headingStack.map((entry) => entry.title),
          textLines: [],
          ordinal,
        };
        continue;
      }
      current.textLines.push(line.trim());
    }
    flush();

    return {
      title: input.title,
      sourceFormat: "html",
      text: normalizeWhitespace(
        sections.map((section) => `${section.heading ?? ""}\n${section.text}`).join("\n\n")
      ),
      sections,
      metadata: {
        ...(input.metadata ?? {}),
        sourcePath: input.sourcePath ?? null,
        extractor: "html_heading_v1",
      },
    };
  },
};

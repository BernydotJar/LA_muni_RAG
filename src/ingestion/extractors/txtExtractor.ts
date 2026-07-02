import { buildCitationLabel } from "../citation.js";
import {
  contentToText,
  detectArticleNumber,
  isLikelyHeading,
  normalizeWhitespace,
} from "../normalize.js";
import type { DocumentExtractor, ExtractorInput, NormalizedDocument, NormalizedSection } from "../types.js";

interface TextSectionDraft {
  heading: string | null;
  lines: string[];
  ordinal: number;
}

const sectionFromDraft = (title: string, draft: TextSectionDraft): NormalizedSection | null => {
  const text = normalizeWhitespace(draft.lines.join("\n"));
  if (!text && !draft.heading) return null;

  const heading = draft.heading ?? `Seccion ${draft.ordinal}`;
  const articleNumber = detectArticleNumber(heading);
  const sectionPath = [heading];

  return {
    heading,
    sectionType: articleNumber ? "article" : draft.heading ? "heading" : "paragraph",
    sectionPath,
    text: text || heading,
    pageStart: null,
    pageEnd: null,
    articleNumber,
    citationLabel: buildCitationLabel({ title, sectionPath, heading, articleNumber }),
    metadata: {
      ordinal: draft.ordinal,
      extractor: "txt_heading_v1",
    },
  };
};

export const txtExtractor: DocumentExtractor = {
  sourceFormat: "txt",

  extract(input: ExtractorInput): NormalizedDocument {
    const text = normalizeWhitespace(contentToText(input.content));
    const lines = text.split("\n");
    const sections: NormalizedSection[] = [];

    let ordinal = 1;
    let current: TextSectionDraft = {
      heading: null,
      lines: [],
      ordinal,
    };

    const flush = (): void => {
      const section = sectionFromDraft(input.title, current);
      if (section) sections.push(section);
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (isLikelyHeading(trimmed)) {
        flush();
        ordinal += 1;
        current = {
          heading: trimmed,
          lines: [],
          ordinal,
        };
        continue;
      }

      current.lines.push(line);
    }

    flush();

    return {
      title: input.title,
      sourceFormat: "txt",
      text,
      sections,
      metadata: {
        ...(input.metadata ?? {}),
        sourcePath: input.sourcePath ?? null,
        extractor: "txt_heading_v1",
      },
    };
  },
};

import { buildCitationLabel } from "../citation.js";
import {
  contentToText,
  detectArticleNumber,
  normalizeWhitespace,
  stripMarkdownInline,
} from "../normalize.js";
import type { DocumentExtractor, ExtractorInput, NormalizedDocument, NormalizedSection } from "../types.js";

interface HeadingState {
  level: number;
  title: string;
}

interface SectionDraft {
  heading: string | null;
  sectionPath: string[];
  textLines: string[];
  articleNumber: string | null;
  ordinal: number;
}

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

const sectionFromDraft = (title: string, draft: SectionDraft): NormalizedSection | null => {
  const text = normalizeWhitespace(draft.textLines.join("\n"));
  if (!text && !draft.heading) return null;

  const articleNumber = draft.articleNumber ?? (draft.heading ? detectArticleNumber(draft.heading) : null);
  const sectionType = articleNumber ? "article" : draft.heading ? "heading" : "section";
  const heading = draft.heading ?? title;
  const sectionPath = draft.sectionPath.length > 0 ? draft.sectionPath : [heading];

  return {
    heading,
    sectionType,
    sectionPath,
    text: text || heading,
    pageStart: null,
    pageEnd: null,
    articleNumber,
    citationLabel: buildCitationLabel({ title, sectionPath, heading, articleNumber }),
    metadata: {
      ordinal: draft.ordinal,
      extractor: "markdown_heading_v1",
    },
  };
};

export const markdownExtractor: DocumentExtractor = {
  sourceFormat: "markdown",

  extract(input: ExtractorInput): NormalizedDocument {
    const text = normalizeWhitespace(contentToText(input.content));
    const lines = text.split("\n");
    const headingStack: HeadingState[] = [];
    const sections: NormalizedSection[] = [];

    let ordinal = 0;
    let current: SectionDraft = {
      heading: null,
      sectionPath: [],
      textLines: [],
      articleNumber: null,
      ordinal,
    };

    const flush = (): void => {
      const section = sectionFromDraft(input.title, current);
      if (section) sections.push(section);
    };

    for (const line of lines) {
      const headingMatch = line.match(headingPattern);
      if (headingMatch) {
        flush();
        ordinal += 1;

        const level = headingMatch[1].length;
        const heading = stripMarkdownInline(headingMatch[2]);
        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }
        headingStack.push({ level, title: heading });

        current = {
          heading,
          sectionPath: headingStack.map((entry) => entry.title),
          textLines: [],
          articleNumber: detectArticleNumber(heading),
          ordinal,
        };
        continue;
      }

      current.textLines.push(stripMarkdownInline(line));
    }

    flush();

    return {
      title: input.title,
      sourceFormat: "markdown",
      text,
      sections,
      metadata: {
        ...(input.metadata ?? {}),
        sourcePath: input.sourcePath ?? null,
        extractor: "markdown_heading_v1",
      },
    };
  },
};

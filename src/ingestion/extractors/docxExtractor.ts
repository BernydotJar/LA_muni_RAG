import { basename, extname } from "node:path";
import mammoth from "mammoth";
import { buildCitationLabel } from "../citation.js";
import {
  contentToText,
  detectArticleNumber,
  isLikelyHeading,
  normalizeWhitespace,
} from "../normalize.js";
import type { DocumentExtractor, ExtractorInput, NormalizedDocument, NormalizedSection } from "../types.js";
import { IngestionError } from "../types.js";

export const REQUIRED_DOCX_PACKAGE = "mammoth";

interface DocxSectionDraft {
  heading: string | null;
  lines: string[];
  ordinal: number;
}

const titleFromPath = (sourcePath?: string): string | null => {
  if (!sourcePath) return null;
  const fileName = basename(sourcePath);
  const extension = extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
};

const inferTitle = (input: ExtractorInput, text: string): string => {
  const firstMeaningfulLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (firstMeaningfulLine && isLikelyHeading(firstMeaningfulLine)) {
    return firstMeaningfulLine;
  }

  const explicitTitle = input.title.trim();
  if (explicitTitle) return explicitTitle;

  return titleFromPath(input.sourcePath) ?? "Documento DOCX";
};

const sectionFromDraft = (title: string, draft: DocxSectionDraft): NormalizedSection | null => {
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
      extractor: "mammoth_raw_text_v1",
    },
  };
};

const sectionsFromText = (title: string, text: string): NormalizedSection[] => {
  const lines = text.split("\n");
  const sections: NormalizedSection[] = [];
  let ordinal = 1;
  let current: DocxSectionDraft = {
    heading: null,
    lines: [],
    ordinal,
  };

  const flush = (): void => {
    const section = sectionFromDraft(title, current);
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
  return sections;
};

export const docxExtractor: DocumentExtractor = {
  sourceFormat: "docx",

  async extract(input: ExtractorInput): Promise<NormalizedDocument> {
    let result: Awaited<ReturnType<typeof mammoth.extractRawText>>;
    try {
      result = Buffer.isBuffer(input.content)
        ? await mammoth.extractRawText({ buffer: input.content })
        : input.sourcePath
          ? await mammoth.extractRawText({ path: input.sourcePath })
          : await mammoth.extractRawText({ buffer: Buffer.from(contentToText(input.content), "utf-8") });
    } catch (error) {
      throw new IngestionError(
        "docx_extraction_failed",
        "docx",
        "DOCX extraction failed. The file may be empty, corrupt, encrypted, or not a valid DOCX archive.",
        { cause: error }
      );
    }

    const text = normalizeWhitespace(result.value);
    const title = inferTitle(input, text);
    const sections = sectionsFromText(title, text);

    return {
      title,
      sourceFormat: "docx",
      text,
      sections,
      metadata: {
        ...(input.metadata ?? {}),
        sourcePath: input.sourcePath ?? null,
        extractor: "mammoth_raw_text_v1",
        mammothMessages: result.messages,
      },
    };
  },
};

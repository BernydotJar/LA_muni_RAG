export type SourceFormat = "markdown" | "txt" | "docx" | "pdf";

export type NormalizedSectionType =
  | "title"
  | "heading"
  | "article"
  | "section"
  | "paragraph"
  | "page";

export interface NormalizedSection {
  heading: string | null;
  sectionType: NormalizedSectionType;
  sectionPath: string[];
  text: string;
  pageStart: number | null;
  pageEnd: number | null;
  articleNumber: string | null;
  citationLabel: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedDocument {
  title: string;
  sourceFormat: SourceFormat;
  text: string;
  sections: NormalizedSection[];
  metadata: Record<string, unknown>;
}

export interface ExtractorInput {
  title: string;
  content: string | Buffer;
  sourcePath?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentExtractor {
  readonly sourceFormat: SourceFormat;
  extract(input: ExtractorInput): Promise<NormalizedDocument> | NormalizedDocument;
}

export class UnsupportedFormatError extends Error {
  constructor(
    public readonly sourceFormat: SourceFormat,
    message: string
  ) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

export class IngestionError extends Error {
  constructor(
    public readonly code: string,
    public readonly sourceFormat: SourceFormat,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "IngestionError";
  }
}

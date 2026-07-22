import { detectFormat } from "./detectFormat.js";
import { docxExtractor } from "./extractors/docxExtractor.js";
import { markdownExtractor } from "./extractors/markdownExtractor.js";
import { rawPdfExtractor } from "./extractors/rawPdfExtractor.js";
import { txtExtractor } from "./extractors/txtExtractor.js";
import type { DocumentExtractor, ExtractorInput, NormalizedDocument, SourceFormat } from "./types.js";
import { UnsupportedFormatError } from "./types.js";

const extractors: Partial<Record<SourceFormat, DocumentExtractor>> = {
  markdown: markdownExtractor,
  txt: txtExtractor,
  docx: docxExtractor,
  pdf: rawPdfExtractor,
};

export const getExtractor = (format: SourceFormat): DocumentExtractor => {
  const extractor = extractors[format];
  if (!extractor) {
    throw new UnsupportedFormatError(
      format,
      `No extractor is registered for ${format}.`
    );
  }
  return extractor;
};

export const extractByFormat = (
  format: SourceFormat,
  input: ExtractorInput
): Promise<NormalizedDocument> | NormalizedDocument => {
  return getExtractor(format).extract(input);
};

export const extractByPath = (
  sourcePath: string,
  input: Omit<ExtractorInput, "sourcePath">
): Promise<NormalizedDocument> | NormalizedDocument => {
  const format = detectFormat(sourcePath);
  return extractByFormat(format, { ...input, sourcePath });
};

export const registeredFormats = (): SourceFormat[] =>
  Object.keys(extractors) as SourceFormat[];

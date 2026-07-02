import type { NormalizedDocument, NormalizedSection } from "../ingestion/types.js";
import { normalizeWhitespace } from "../ingestion/normalize.js";
import { buildChunkId, sha256Hex } from "./chunkIdentity.js";
import type { ChunkPlannerOptions, EmbeddingChunk, EmbeddingSource, PlanChunksInput } from "./types.js";

export const DEFAULT_CHUNK_PLANNER_OPTIONS: ChunkPlannerOptions = {
  maxChars: 1_800,
  overlapChars: 180,
};

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const splitLongText = (
  text: string,
  { maxChars, overlapChars }: ChunkPlannerOptions
): string[] => {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    for (let start = 0; start < paragraph.length; start += Math.max(1, maxChars - overlapChars)) {
      chunks.push(paragraph.slice(start, start + maxChars).trim());
    }
    current = "";
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
};

const sourceFromSection = (
  document: NormalizedDocument,
  section: NormalizedSection,
  input: PlanChunksInput
): EmbeddingSource => ({
  documentKey: input.documentKey,
  documentTitle: document.title,
  documentVersion: input.documentVersion,
  sourceFormat: document.sourceFormat,
  sectionPath: section.sectionPath,
  sectionType: section.sectionType,
  pageStart: section.pageStart,
  pageEnd: section.pageEnd,
  articleNumber: section.articleNumber,
  citationLabel: section.citationLabel,
});

export const planChunks = (
  document: NormalizedDocument,
  input: PlanChunksInput,
  options: ChunkPlannerOptions = DEFAULT_CHUNK_PLANNER_OPTIONS
): EmbeddingChunk[] => {
  const chunks: EmbeddingChunk[] = [];
  let chunkOrdinal = 1;

  for (const section of document.sections) {
    const sectionText = normalizeWhitespace(section.text);
    if (!sectionText) continue;

    const source = sourceFromSection(document, section, input);
    const sectionChunks = splitLongText(sectionText, options);

    for (const text of sectionChunks) {
      const contentSha256 = sha256Hex(text);
      chunks.push({
        chunkId: buildChunkId(source, contentSha256, chunkOrdinal),
        chunkOrdinal,
        text,
        contentSha256,
        tokenEstimate: estimateTokens(text),
        source,
        metadata: {
          documentMetadata: document.metadata,
          sourcePath: typeof document.metadata.sourcePath === "string" ? document.metadata.sourcePath : null,
          sourceFormat: document.sourceFormat,
          sectionMetadata: section.metadata,
          planner: "section_text_v1",
        },
      });
      chunkOrdinal += 1;
    }
  }

  return chunks;
};

import type { NormalizedDocument, NormalizedSection } from "../ingestion/types.js";
import { normalizeWhitespace } from "../ingestion/normalize.js";
import { buildChunkId, sha256Hex } from "./chunkIdentity.js";
import { EmbeddingPipelineError } from "./types.js";
import type { ChunkPlannerOptions, EmbeddingChunk, EmbeddingSource, PlanChunksInput } from "./types.js";

export const DEFAULT_CHUNK_PLANNER_OPTIONS: ChunkPlannerOptions = {
  maxChars: 1_800,
  overlapChars: 180,
};

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const assertPlannerOptions = ({ maxChars, overlapChars }: ChunkPlannerOptions): void => {
  if (!Number.isSafeInteger(maxChars) || maxChars < 32 || maxChars > 1_000_000) {
    throw new EmbeddingPipelineError(
      "chunk_planner_policy_invalid",
      "maxChars must be an integer between 32 and 1000000.",
      false
    );
  }
  if (
    !Number.isSafeInteger(overlapChars) ||
    overlapChars < 0 ||
    overlapChars >= maxChars ||
    overlapChars > Math.floor(maxChars / 2)
  ) {
    throw new EmbeddingPipelineError(
      "chunk_planner_policy_invalid",
      "overlapChars must be an integer between 0 and half of maxChars.",
      false
    );
  }
};

function* splitLongText(
  text: string,
  { maxChars, overlapChars }: ChunkPlannerOptions
): Generator<string> {
  if (text.length <= maxChars) {
    yield text;
    return;
  }

  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) yield current;

    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }

    for (let start = 0; start < paragraph.length; start += Math.max(1, maxChars - overlapChars)) {
      const chunk = paragraph.slice(start, start + maxChars).trim();
      if (chunk) yield chunk;
    }
    current = "";
  }

  if (current) yield current;
}

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
  options: ChunkPlannerOptions = DEFAULT_CHUNK_PLANNER_OPTIONS,
  maxChunks = Number.MAX_SAFE_INTEGER
): EmbeddingChunk[] => {
  assertPlannerOptions(options);
  if (!Number.isSafeInteger(maxChunks) || maxChunks < 1) {
    throw new EmbeddingPipelineError(
      "embedding_resource_policy_invalid",
      "maxChunks must be a positive safe integer.",
      false
    );
  }
  const chunks: EmbeddingChunk[] = [];
  let chunkOrdinal = 1;

  for (const section of document.sections) {
    const sectionText = normalizeWhitespace(section.text);
    if (!sectionText) continue;

    const source = sourceFromSection(document, section, input);
    for (const text of splitLongText(sectionText, options)) {
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
      if (chunks.length > maxChunks) return chunks;
      chunkOrdinal += 1;
    }
  }

  return chunks;
};

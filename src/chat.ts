import { evaluateQuery, evaluateQueryWithDependencies, type AgentResponse } from "./agent.js";
import type { EvidenceDependencies, EvidenceMode } from "./evidence.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatCitation {
  citationLabel: string;
  sourceType: string;
  pageStart: number | null;
  excerpt: string;
}

export interface ChatResponse {
  role: "assistant";
  content: string;
  citations: ChatCitation[];
  meta: {
    responseLabel: string;
    confidence: string;
    evidenceCount: number;
    suggestedAction: string;
  };
}

// ---------------------------------------------------------------------------
// Response formatters — Spanish language for municipal users
// ---------------------------------------------------------------------------

const SOURCE_TYPE_LABELS: Record<string, string> = {
  constitution: "Constitución",
  law: "Ley",
  decree: "Decreto",
  regulation: "Reglamento",
  municipal_agreement: "Acuerdo Municipal",
  council_minutes: "Acta de Concejo",
  plan: "Plan Municipal",
  manual: "Manual",
  procedure: "Procedimiento",
  form: "Formulario",
  guide: "Guía",
  jurisprudence: "Jurisprudencia",
  other: "Otro documento",
};

const friendlySourceType = (type: string): string =>
  SOURCE_TYPE_LABELS[type] ?? type;

const formatEvidenceFound = (agentResponse: AgentResponse): string => {
  const { evidence, context } = agentResponse;
  const count = evidence.length;
  const types = context.sourceTypes.map(friendlySourceType);
  const typeList = [...new Set(types)].join(", ");

  const intro =
    count === 1
      ? `Encontré **1 referencia** en ${typeList} relacionada con tu consulta.`
      : `Encontré **${count} referencias** en ${typeList} relacionadas con tu consulta.`;

  const citationLines = evidence.map((e, i) => {
    const label = e.citationLabel;
    const typeLabel = friendlySourceType(e.sourceType);
    const excerpt =
      e.excerpt.length > 200 ? e.excerpt.slice(0, 200) + "…" : e.excerpt;
    return `**${i + 1}. ${label}** _(${typeLabel})_\n> ${excerpt}`;
  });

  return `${intro}\n\n${citationLines.join("\n\n")}`;
};

const formatInsufficientEvidence = (agentResponse: AgentResponse): string => {
  const { query, evidence } = agentResponse;
  if (evidence.length === 0) {
    return `Encontré resultados limitados para **"${query}"**. La evidencia disponible puede no ser suficiente para responder con certeza. ¿Podrías reformular tu pregunta o ser más específico?`;
  }

  const citationLines = evidence.map((e, i) => {
    const label = e.citationLabel;
    return `**${i + 1}. ${label}**\n> ${e.excerpt.length > 150 ? e.excerpt.slice(0, 150) + "…" : e.excerpt}`;
  });

  return `Encontré resultados limitados para **"${query}"**. La evidencia puede no ser suficiente:\n\n${citationLines.join("\n\n")}\n\n¿Podrías reformular tu pregunta o ser más específico?`;
};

const formatNotFound = (query: string): string =>
  `No encontré evidencia sobre **"${query}"** en los documentos municipales disponibles.\n\nPuedes intentar con:\n- Palabras clave más generales\n- Nombres específicos de documentos o artículos\n- Temas como "ordenamiento territorial", "patrimonio", o "construcción"`;

const formatChatResponse = (message: string, agentResponse: AgentResponse): ChatResponse => {
  let content: string;
  switch (agentResponse.responseLabel) {
    case "evidence_found":
      content = formatEvidenceFound(agentResponse);
      break;
    case "insufficient_evidence":
      content = formatInsufficientEvidence(agentResponse);
      break;
    case "not_found":
      content = formatNotFound(message);
      break;
  }

  const citations: ChatCitation[] = agentResponse.evidence.map((e) => ({
    citationLabel: e.citationLabel,
    sourceType: e.sourceType,
    pageStart: e.pageStart,
    excerpt: e.excerpt.length > 300 ? e.excerpt.slice(0, 300) + "…" : e.excerpt,
  }));

  return {
    role: "assistant",
    content,
    citations,
    meta: {
      responseLabel: agentResponse.responseLabel,
      confidence: agentResponse.confidence,
      evidenceCount: agentResponse.context.evidenceCount,
      suggestedAction: agentResponse.context.suggestedAction,
    },
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a user chat message: run the agent, format a human-readable
 * response in Spanish with citations.
 */
export const processChatWithDependencies = async (
  message: string,
  mode: EvidenceMode = "keyword",
  limit = 5,
  dependencies: EvidenceDependencies = {}
): Promise<ChatResponse> => {
  const agentResponse = await evaluateQueryWithDependencies(message, mode, limit, dependencies);
  return formatChatResponse(message, agentResponse);
};

export const processChat = async (
  message: string,
  mode: EvidenceMode = "keyword",
  limit = 5
): Promise<ChatResponse> => {
  const agentResponse = await evaluateQuery(message, mode, limit);
  return formatChatResponse(message, agentResponse);
};

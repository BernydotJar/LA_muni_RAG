# Design — Municipal Demo and Governance Pack

## Design Principle

The application should be presented as a municipal evidence assistant, not as a generic AI demo. The presenter should lead with public value, traceability, and responsible use.

## Presentation Structure

1. Problem framing: municipal documents are long, technical, and hard for citizens or staff to search.
2. Product promise: ask a question in Spanish and receive a concise answer backed by document evidence.
3. Trust model: the assistant cites sources, separates interpretation from evidence, and states when coverage is limited.
4. Technical transparency: Glass Wall shows the retrieval route without exposing sensitive operational details.
5. Governance position: the tool supports review and public access; it does not replace legal, technical, or council judgment.

## Demo Flow

- Open the homepage and establish local institutional identity.
- Launch the municipal assistant.
- Ask a broad query: `necesidades más urgentes`.
- Show synthesis, findings, visible sources, and traceability seal.
- Ask a concrete query: `agua`.
- Show source pages and evidence excerpts.
- Open Glass Wall and inspect the same query.
- Explain vector, lexical, and exact phrase routes in plain language.

## Stakeholder Lens

- Mayor or council: decision support and transparency.
- Planning office: faster document review and prioritization.
- Legal/compliance: cited evidence, source limits, and human review.
- IT: bounded endpoints, no public exposure of internal runtime details.
- Communications: citizen-friendly language and reusable answers.

## Readiness Definition

The demo is ready when a non-technical municipal stakeholder can understand what the system found, where it found it, and what the system is not claiming.

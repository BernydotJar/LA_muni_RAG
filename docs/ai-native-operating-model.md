# AI-Native Operating Model Notes

## Purpose

These notes integrate the attached AI-native company transcript as product direction for LA Muni RAG. The transcript is not municipal evidence and must not be used as legal/procedural authority. It is an operating-model input for how the product should evolve.

## Product principles extracted

### 1. AI-native is culture, not only tooling

The transcript frames AI-native work as a culture change, not as simply giving people access to tools such as coding agents or chat assistants. For this repo, that means the RAG should not stop at chat. It should create operational artifacts that teams can review and improve.

### 2. Capture signal as machine-readable signal

AI-native operations require discipline around recording and converting work into usable signal: transcripts, support, feedback, analytics, documents, and customer interactions. For LA Muni RAG, this maps to document ingestion, evidence normalization, case files, workflow output, and future feedback capture.

### 3. Governance comes before access

The transcript emphasizes that broad AI access is different from unrestricted data access. This repo should keep the same posture: public answers and procedure workflows must be grounded in safe evidence, while private or sensitive municipal material requires permissions, redaction, and auditability.

### 4. Internal APIs are the interface for AI systems

AI systems need safe, narrow, queryable interfaces to organizational data. In this project, `/api/chat`, `/api/evidence`, `/api/answer`, and `/api/procedure` are examples of that boundary. Future endpoints should remain explicit and testable.

### 5. Optimize an outcome object

The transcript describes an "object of result" that improves with better information: classes, decks, simulations, or other artifacts. In LA Muni RAG, the current outcome object is `ProcedureWorkflow`.

A good `ProcedureWorkflow` should improve as the corpus gains:

- official Antigua manuals;
- case files;
- council minutes;
- budget files;
- COCODE/community evidence;
- feedback on missing steps;
- validation by municipal roles.

### 6. Use simulators and evaluators to guide next action

The sales simulation example in the transcript evaluates performance against goals and points the learner toward the missing lesson. For LA Muni RAG, the analogous pattern is:

- show the workflow;
- expose missing documents;
- score confidence;
- show validation warnings;
- suggest the next document or authority needed.

### 7. Everyone creates

The transcript's final operating principle is that AI-native teams are less hierarchical and more creative: support, managers, leaders, and operators all create improvements. For this product, the UI should make it easy for non-engineers to copy a checklist, identify a missing document, and propose a correction.

## Product implication for Feature 038

The widget entrypoint should not be just a link. It should signal that chat is one mode and workflow generation is another mode. This supports the AI-native pattern of turning knowledge into an actionable artifact.

## Future backlog

- Capture user feedback on generated workflows.
- Add a validation status per workflow step.
- Track missing document frequency as a product signal.
- Add evaluator checks for generated workflow quality.
- Build role-specific views: citizen, project manager, legal, DAFIM, technical unit.
- Add a simulation/training mode for municipal staff, inspired by goal-based learning and evaluator loops.

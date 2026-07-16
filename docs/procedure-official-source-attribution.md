# Official Source Attribution for Procedure Steps

This follow-up improves Procedure Workflow evidence presentation after Feature 052.

## Purpose

A generic warning such as `Requiere validación contra fuente oficial de Antigua Guatemala` is only useful when the system did not retrieve an authoritative source for the step.

When the RAG has already retrieved a classified source, the workflow now identifies that source directly.

## Attribution states

### `official_municipal`

Used when the matched citation belongs to a `primary` authority class in the active domain pack, such as:

- municipal manual;
- MOF;
- organigram;
- PDM-OT;
- POM/POA;
- municipal budget;
- council minutes;
- case file.

The UI displays the citation label, authority label, page, excerpt, and a safe source link when `sourceUrl` is available.

### `official_national`

Used for a `national` authority class, such as national law or the Municipal Code.

A national rule can support the legal basis of a step, but it does not automatically prove the Municipality of Antigua Guatemala's internal implementation. The UI therefore distinguishes national legal support from municipal operational procedure.

### `comparative`

Used for material from another municipality or an external entity.

Comparative material remains useful for research but is never represented as the official Antigua Guatemala procedure.

### `contextual`

Used for operational, community, planning-context, or other non-normative material that informs the case but cannot establish a formal obligation by itself.

### `insufficient`

Used only when no matched authoritative citation is available or when the source cannot be classified as sufficient.

The fallback remains:

```text
No encontré base documental suficiente para afirmar este paso.
```

## Contract additions

Each `ProcedureCitation` now includes:

```ts
authorityLabel?: string;
authorityLevel?: "primary" | "national" | "comparative" | "context" | "unknown";
```

Each `ProcedureStep` may include:

```ts
sourceAttribution?: {
  status: "official_municipal" | "official_national" | "comparative" | "contextual" | "insufficient";
  heading: string;
  statement: string;
  primaryCitation?: ProcedureCitation;
  citations: ProcedureCitation[];
};
```

## Safety

- Authority is derived from the active domain-pack classification metadata.
- The UI does not infer official status from visual wording alone.
- Only HTTP(S) source links are rendered.
- External references remain comparative.
- National law is not presented as proof of a municipal internal practice.
- Missing sources remain explicitly missing.

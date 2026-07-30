# External tool assessment for production transition

Date: 2026-07-22
Status: evaluated for fit; no dependency added or model downloaded

## OpenSEO

The referenced project is a self-hostable SEO/visibility product. It may be
useful later for metadata, structured data, sitemap and public discoverability,
but it does not belong in the retrieval, evidence, authentication or ingestion
runtime. Adoption is deferred until a public production domain and content
policy exist.

## Baidu Unlimited-OCR

Unlimited-OCR is a new multilingual image-to-text model with custom model code
and GPU-oriented serving paths. It is a candidate for an isolated OCR benchmark,
not a direct production dependency. An evaluation must pin an immutable model
revision, prohibit unreviewed remote code, use non-sensitive municipal samples,
measure page accuracy/structure/hallucination/latency/cost, bound input/output and
run outside the API process. Existing PDF text extraction and malware gates stay
in force.

## awesome-design-md

The repository demonstrates using a root `DESIGN.md` to make UI rules explicit
for people and coding agents. LA Muni RAG adopts that pattern through its own
original `DESIGN.md`; no third-party design files or generated UI code are
copied.

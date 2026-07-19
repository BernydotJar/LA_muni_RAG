# Antigua procedure-manual source verification

Status: catalog verified; individual DMP artifact acquired; extraction and ingestion pending
Verified at: 2026-07-19T03:53:06Z
Target jurisdiction: Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala

## Verified official discovery surface

The Municipality of La Antigua Guatemala publishes an official access-to-information
catalog at:

- portal: <https://muniantigua.gob.gt/informacion/>;
- category 6, “Manuales de procedimientos”:
  <https://muniantigua.gob.gt/informacionDetalle/?idinfo=6>;
- category API: <https://muniantigua.gob.gt/api/public/consultas/articulo/6>;
- document catalog API: <https://muniantigua.gob.gt/api/public/consultas/documentos/6>.

At verification time, the document API returned 89 catalog records dated from 2022
through 2026, including 21 records labeled 2026. This proves that the municipal
catalog exists and identifies candidate documents. It does not prove that any PDF
has been acquired, hashed, inspected, approved, or ingested.

The inventory record `antigua-manuales-procedimientos` therefore moves from
`missing_source` to `verified`. It remains a catalog-level record and has no
`acquisition`, `extraction`, or `indexing` evidence.

## Priority individual candidate

The highest-value individual candidate found in that catalog is:

- catalog title: `N06- Manual de Normas y Procedimientos - Dirección Municipal de
  Planificación (versión 3)`;
- catalog year: 2026;
- portal publication value: `2026-02-17 17:59:00` with no timezone declared;
- direct municipal URL:
  <https://muniantigua.gob.gt/assets/backend/info/6_2026_eu9Z7.pdf>.

A metadata-only HTTP check returned status 200, `Content-Type: application/pdf`,
`Content-Length: 49052885`, `Accept-Ranges: bytes`, and `Last-Modified: Wed, 03 Jun
2026 18:01:37 GMT`. The server did not publish a cryptographic checksum. Its Apache
ETag is an opaque cache identifier and is not recorded as a document hash.

The record `antigua-mnp-dmp-v3-2026` first entered `acquisition_pending`. Its stable
declared version is `official-municipal-pdf-2026-02-17-v3`; the version name did not
by itself prove acquisition.

Feature 054 subsequently copied the exact 49,052,885 bytes into the Git-ignored,
bounded local library and verified the copied bytes. The acquired SHA-256 is
`4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9`, the PDF
header is `%PDF-1.4`, and file identification reports a 16-page PDF 1.4 document.
The portable inventory stores the repository-relative artifact path rather than a
workstation-specific absolute path. This evidence supports `acquired`; it does not
support `extracted` or `ingested`.

After the artifact-safety gate was added, a read-only `import --dry-run` against
those same controlled bytes returned `noop`, the same SHA-256, zero sections,
zero chunks, `mutated: false`, and no failures. This additionally proves the
current PDF header/trailer, extension, declared MIME, size, and hash checks pass.
It deliberately returned `artifactSafety: null`: neither `clamdscan` nor
`clamscan` is installed in the current runtime, so no malware verdict is claimed.

## Authority and use boundary

The portal is operated under the Municipality of La Antigua Guatemala domain and
the candidate is classified as official municipal, primary authority for the target
jurisdiction. Portal metadata alone does not establish internal approval, effective
date, current validity, completeness, or immutability.

The official Guatemalan Access to Public Information Law is available from Congress
at <https://www.congreso.gob.gt/assets/uploads/info_legislativo/decretos/2008/57-2008.pdf>.
It covers municipalities as obligated entities and requires publication of
administrative and operational manuals. This supports controlled public-interest
retrieval; it is not a redistribution license. No express reuse license was found,
so republication requires attribution and legal review.

## Acquisition evidence and remaining promotion gate

The controlled acquisition completed these steps:

1. reverify the official catalog entry and direct URL;
2. copy the original bytes through the controlled document-library import path;
3. record the SHA-256, exact byte length, media type, acquisition time, and bounded
   repository-relative artifact path;
4. reread the copied artifact and verify its SHA-256;
5. retain the mutable-URL and redistribution limitations.

Before extraction or ingestion:

1. run the document-library `inspect` gate with a real, current ClamAV runtime and
   require clean evidence bound to the acquired path, hash, size, and MIME type;
2. reconcile the internal title, version, approval, and effective-date evidence;
3. record a positive section count through the future isolated raw-PDF extractor;
4. run indexing with configured production-shaped embedding and tenant-scoped
   vector dependencies;
5. reconcile a matching corpus-manifest document version and hash.

Extraction and indexing remain separate gates. Neither follows automatically from
successful acquisition. The current DMP record has no `artifactSafety` evidence;
the scanner adapter and quarantine workflow are implemented locally, but a real
scanner runtime has not evaluated this artifact.

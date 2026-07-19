# Antigua procedure-manual source verification

Status: catalog verified; individual DMP artifact acquisition pending
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

The record `antigua-mnp-dmp-v3-2026` is consequently
`acquisition_pending`. No PDF bytes were downloaded as part of this verification,
and no `acquired` or `ingested` claim is made.

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

## Promotion gate

Before the individual record may become `acquired`:

1. reverify the official catalog entry and direct URL;
2. copy the original bytes through the controlled document-library import path;
3. record the SHA-256, exact byte length, media type, acquisition time, and bounded
   artifact path;
4. inspect the PDF safely and reconcile its internal title, version, approval, and
   effective-date evidence;
5. retain the mutable-URL and redistribution limitations.

Extraction and indexing remain separate gates. Neither follows automatically from
successful acquisition.

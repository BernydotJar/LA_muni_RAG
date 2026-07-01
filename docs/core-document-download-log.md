# Core Document Download Log

Last updated: 2026-06-22
Owner: Product Engineering
Status: Draft

## Objective

Record which core documents have a verified local file ready for extraction.

## Verified Downloads

| Document | Source | Local file | SHA-256 | Status |
|---|---|---|---|---|
| PDM-OT de Antigua Guatemala | `https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf` | `data/raw/core-documents/pdm-ot-antigua-modulo-1.pdf` | `824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b` | Verified PDF |

## Blocked Downloads

| Document | Attempted source | Result | Required next step |
|---|---|---|---|
| Constitucion Politica de la Republica de Guatemala | Congreso PDF URL | Server returned a 212-byte HTML protection page instead of PDF | Download manually from official Congreso page or find an alternate official PDF endpoint |
| Codigo Municipal, Decreto Numero 12-2002 | Congreso PDF URL | Server returned a 212-byte HTML protection page instead of PDF | Download manually from official Congreso page or find an alternate official PDF endpoint |
| Ley Protectora de la Ciudad de La Antigua Guatemala, Decreto Numero 60-69 | No verified direct official PDF yet | Not downloaded | Locate official gazette, Congreso, CNPAG, or municipal source |

## Mentor Note

Do not trust a filename. Trust the file type, size, source, and hash.

The failed Congreso downloads had `.pdf` filenames but were HTML anti-bot pages.
If we had ingested them blindly, the corpus would contain garbage while the
system falsely claimed it had processed official legal PDFs.


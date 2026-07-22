# Risk register — Feature 072

| ID | Severity | Risk | Control | Residual gap |
|---|---|---|---|---|
| PQG-01 | critical | Browser chooses another tenant | tenant/jurisdiction absent from closed request and set server-side | production configuration review required |
| PQG-02 | critical | Service credential leaks to browser | no bearer requirement; Authorization/Cookie rejected; no secret in response | Pages/runtime secret review required |
| PQG-03 | critical | Private or unaccepted evidence leaks | forced RLS plus exact public/active/processed/accepted/clean eligibility | real corpus and production grants unproved |
| PQG-04 | high | Comparative evidence becomes official answer | supported-only answer state; comparative remains citation/insufficient evidence | human corroboration workflow open |
| PQG-05 | high | Signed/object URL leaks | HTTPS-only URL without credentials/query/fragment | source-link human review pending |
| PQG-06 | high | Raw IP, UA or query persists | HMAC rate identity and allowlisted audit; no raw columns | external logs/edge configuration unproved |
| PQG-07 | high | Anonymous traffic causes cost/DoS | lexical-only v1, global/client DB limits, bounded body/results | Cloud Armor, load, quotas and alerts absent |
| PQG-08 | high | Rate table grows indefinitely | expired-bucket cleanup before upsert | production vacuum/load evidence absent |
| PQG-09 | high | Disabled route is mistaken for usable product | default false, bounded 503, Pages remains unconfigured | authorized ingested corpus absent |
| PQG-10 | medium | DB rate/audit failure leaks internals | safe 500/503 errors and no-store | operational alerting not deployed |

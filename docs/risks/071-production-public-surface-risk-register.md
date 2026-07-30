# Risk register — Feature 071

| ID | Severity | Risk | Control | Residual gap |
|---|---|---|---|---|
| PPS-01 | critical | Static Pages fabricates municipal evidence | demo bridge removed; approved routes return 503 without API | deployment must use the current artifact |
| PPS-02 | critical | Browser receives tenant/service Bearer credential | no credential input/forwarding; public gateway required | gateway not implemented |
| PPS-03 | critical | Legacy `/api/chat` is reopened in production | production 404 contract retained | public assistant unavailable until gateway |
| PPS-04 | high | UI claims verified/official corpus without evidence | claims removed; evidence derived from response only | real corpus and human review absent |
| PPS-05 | high | Glassmorphism reduces contrast | opaque surfaces, lighter secondary text, focus tokens | automated contrast plus human AT review pending |
| PPS-06 | high | Cloud resources create uncontrolled cost | architecture only; no apply; min/max/budget controls specified | project/budget owners absent |
| PPS-07 | high | New OCR model executes unreviewed code/data | evaluation-only decision, pinned revision and sandbox required | benchmark not run |
| PPS-08 | medium | SEO tooling expands attack/ops surface | deferred outside core runtime | public domain/content policy absent |
| PPS-09 | medium | Historical demo docs mislead operators | current docs mark old bridge superseded | historical specs remain as history |

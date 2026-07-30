# Feature 081 accessibility risk review

Date: 2026-07-27
Scope: automated cross-browser complement for the authenticated shell

| Risk | Control implemented | Verification | Residual risk / next gate |
|---|---|---|---|
| Anonymous users encounter unusable role controls | product navigation hidden until authenticated state | focused source test and all-engine browser assertion | future anonymous/error surfaces require renewed review |
| Interactive control has no accessible name | browser-computed bounded name check for visible controls | Chromium/Firefox/WebKit smoke | computed-name approximation is not a full accessibility API inspection |
| Duplicate IDs break labels/navigation | source and runtime duplicate-ID checks | focused and browser gates | dynamically generated future modules need equivalent checks |
| Hidden content remains keyboard-focusable | runtime hidden-focus containment audit | all-engine smoke | browser/AT virtual navigation behavior requires human review |
| Targets are difficult to activate | 24 by 24 CSS-pixel minimum for visible controls | runtime geometry audit | touch spacing and motor-access review remain human tasks |
| Heading hierarchy becomes confusing | visible heading-level jump check | all-engine smoke | semantic quality and wording still require human judgment |
| Narrow viewport causes horizontal scrolling | 320-pixel document overflow check | all-engine smoke | 200%/400% zoom, text spacing and embedded module layouts remain untested |
| Focus indication or motion harms users | focus-visible styles and reduced-motion media query | focused source tests | forced-colors/high-contrast and vestibular review remain incomplete |
| One engine hides a regression | same deterministic smoke in Chromium, Firefox and WebKit | CI cross-browser gate | supported browser/AT combinations require explicit policy |
| Automation is reported as WCAG conformance | spec/docs/output state complement only and preserve 0/12 | named EVAL and program records | stakeholder overstatement remains possible |
| Synthetic content masks workflow barriers | shell checks cover bounded surfaces only | explicit limitation | complete authenticated module workflows and representative content absent |
| Identity test adapter is mistaken for real user evidence | deterministic provider labeled test-only | browser output/EVAL | productive IdP and external municipal users remain absent |

## Review conclusion

The increment materially improves accessibility regression detection across browser engines. It cannot establish WCAG conformance or human usability because complete workflows, representative content, productive identity and assistive-technology users remain absent.

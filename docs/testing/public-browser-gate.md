# Public browser gate

The public browser gate runs the generated `dist-pages` artifact through Playwright in Chromium
with a desktop viewport and Pixel 7 mobile emulation.

```bash
npm ci
npx playwright install chromium
npm run test:browser:public
```

The test server binds only to `127.0.0.1`, serves generated Pages assets, and exposes a
browser-test-only echo harness for the approved Pages bridge routes. It is not a product API and
is never included in the Pages artifact.

The gate verifies:

- responsive shell geometry and absence of horizontal overflow;
- keyboard skip-link focus and programmatic focus of the main landmark;
- disabled assistant behavior when no backend is configured;
- reduced-motion behavior in both document CSS and widget shadow DOM;
- Academy static fallback, knowledge check and bounded progress persistence;
- procedure-workflow HTTP 503 behavior without fabricated workflow output;
- bridge removal of Authorization, Cookie and arbitrary caller headers;
- absence of unexpected page and console errors.

Playwright traces, screenshots, video and HTML reports are ignored local/CI diagnostics. The gate
is public-surface evidence only. It does not satisfy the twelve authenticated browser journeys,
which remain blocked by missing human IdP, BFF/session and role-aware UI evidence.

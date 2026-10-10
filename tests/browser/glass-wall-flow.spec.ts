import { expect, test, type Page } from '@playwright/test';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const found: string[] = [];
  errors.set(page, found);
  page.on('pageerror', (error) => found.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') found.push(message.text()); });
  await page.goto('/glass-wall.html');
  await expect(page.locator('#glass-wall-paths path')).toHaveCount(6);
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function stubQueries(page: Page, scenario: string) {
  await page.evaluate((scenario) => {
    const previous = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input) !== '/api/public/v1/query') return previous(input, init);
      const request = JSON.parse(String(init?.body));
      if (scenario === 'slow') await new Promise((resolve) => setTimeout(resolve, 400));
      if (scenario === 'race') await new Promise((resolve) => setTimeout(resolve, request.message === 'primera' ? 800 : 10));
      if (scenario === 'error' || (scenario === 'partial' && request.mode === 'phrase')) throw new Error('private-error-must-not-render');
      if (scenario === 'rate') return new Response('{}', { status: 429 });
      if (scenario === 'oversized') return new Response('x'.repeat(70000), { status: 200 });
      if (scenario === 'malformed') return new Response('{"meta":{}}', { status: 200 });
      const citations = scenario === 'empty' ? [] : Array.from({ length: 5 }, (_, index) => ({
        citationLabel: scenario === 'markup' ? '<b data-injection-probe="true">Texto documental</b>' : `PDM-OT ${request.message}, página ${index + 1}`,
        sourceUrl: `https://muniantigua.gob.gt/pdm.pdf#page=${index + 1}`,
        excerpt: 'Agua potable y planificación municipal. Fragmento de prueba.'
      }));
      return new Response(JSON.stringify({ schema_version: 'v1', response_type: 'public_query', citations,
        meta: { responseLabel: citations.length ? 'evidence_found' : 'not_found', evidenceCount: citations.length, executedModes: [request.mode] }
      }), { status: 200, headers: { 'content-type': 'application/json', 'x-la-muni-rag-static-fallback': 'true' } });
    };
  }, scenario);
}

async function runQuery(page: Page, query = 'agua potable', mode = 'hybrid') {
  await page.locator('#glass-wall-query').fill(query);
  await page.locator('#glass-wall-mode').selectOption(mode);
  await page.getByRole('button', { name: 'Inspeccionar ruta' }).click();
}

async function verifyGeometry(page: Page) {
  await expect(page.locator('#glass-wall-paths path')).toHaveCount(6);
  await expect.poll(async () => page.evaluate(() => {
    const board = document.getElementById('glass-wall-board')!;
    const b = board.getBoundingClientRect();
    const vertical = board.dataset.orientation === 'vertical';
    return [...document.querySelectorAll<SVGPathElement>('#glass-wall-paths path')].every((path) => {
      const from = document.getElementById(path.dataset.from!)!.getBoundingClientRect();
      const to = document.getElementById(path.dataset.to!)!.getBoundingClientRect();
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      const sx = start.x + b.left, sy = start.y + b.top, ex = end.x + b.left, ey = end.y + b.top;
      const marker = path.getAttribute('marker-end')?.match(/#([\w-]+)/)?.[1];
      const target = marker ? document.getElementById(marker) : null;
      if (!target || target.getAttribute('orient') !== 'auto') return false;
      return vertical ? Math.abs(sy - from.bottom - 3) < 1 && Math.abs(ey - to.top + 6) < 1 && sy < ey :
        Math.abs(sx - from.right - 3) < 1 && Math.abs(ex - to.left + 6) < 1 && sx < ex;
    });
  })).toBe(true);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    transform: getComputedStyle(document.getElementById('glass-wall-board')!).transform,
    font: Math.min(...[...document.querySelectorAll('.node-value')].map((node) => parseFloat(getComputedStyle(node).fontSize)))
  }));
  expect(layout).toEqual({ overflow: false, transform: 'none', font: expect.any(Number) });
  expect(layout.font).toBeGreaterThanOrEqual(12);
}

test('directional map starts idle, then shows only confirmed keyword arrows', async ({ page }) => {
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'idle');
  await expect(page.locator('.edge[data-state="executed"]')).toHaveCount(0);
  await stubQueries(page, 'success');
  await runQuery(page, 'agua', 'keyword');
  await expect(page.locator('#metric-answer-status')).toHaveText('Fuentes encontradas');
  await expect(page.locator('.edge[data-kind="phrase"][data-state="inactive"]')).toHaveCount(2);
  await expect(page.locator('.edge[data-state="executed"]')).toHaveCount(4);
  await expect(page.locator('#metric-evidence-count')).toHaveText('5');
  await expect(page.locator('#metric-document-count')).toHaveText('1');
  await expect(page.locator('#runtime-copy')).toContainText('Consulta local');
  await expect(page.locator('#node-audit')).toContainText('no acredita una auditoría');
  await verifyGeometry(page);
});

test('combined result has visible arrowheads at boundaries across desktop, tablet and narrow mobile', async ({ page }) => {
  await stubQueries(page, 'success');
  await runQuery(page);
  await expect(page.locator('#metric-evidence-count')).toHaveText('5');
  await expect(page.locator('.edge[data-state="executed"]')).toHaveCount(6);
  for (const width of [1440, 1024, 768, 760, 390, 320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await verifyGeometry(page);
    await expect(page.locator('#glass-wall-board')).toHaveAttribute('data-orientation', width <= 760 ? 'vertical' : 'horizontal');
  }
  await page.locator('#node-evidence-1').click();
  await expect(page.locator('#evidence-1')).toBeFocused();
  await expect(page.locator('#evidence-1 a')).toHaveAttribute('rel', 'noopener noreferrer');
});

test('loading state clears old sources and does not flash an empty result', async ({ page }) => {
  await stubQueries(page, 'success');
  await runQuery(page);
  await expect(page.locator('.evidence-item')).toHaveCount(5);
  await stubQueries(page, 'slow');
  await runQuery(page, 'nueva pregunta');
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'loading');
  await expect(page.locator('.evidence-item')).toHaveCount(0);
  await expect(page.locator('#glass-wall-status')).toHaveText('Buscando documentos');
  await expect(page.locator('#glass-wall-submit')).toBeDisabled();
  await expect(page.locator('#metric-answer-status')).toHaveText('Fuentes encontradas');
});

test('empty and failed requests are visibly different; internal paths never participate', async ({ page }) => {
  await stubQueries(page, 'empty');
  await runQuery(page);
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'empty');
  await expect(page.locator('#metric-answer-status')).toHaveText('Sin evidencia suficiente');
  await expect(page.locator('#glass-wall-error')).toBeHidden();
  await stubQueries(page, 'error');
  await runQuery(page);
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'error');
  await expect(page.locator('#metric-answer-status')).toHaveText('Consulta no disponible');
  await expect(page.locator('#glass-wall-error')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('private-error-must-not-render');
  await expect(page.locator('.edge[data-from="node-vector"], .edge[data-from="node-audit"]')).toHaveCount(0);
});

test('partial failure preserves successful evidence and marks the failed method', async ({ page }) => {
  await stubQueries(page, 'partial');
  await runQuery(page);
  await expect(page.locator('#metric-answer-status')).toHaveText('Resultado parcial');
  await expect(page.locator('.evidence-item')).toHaveCount(5);
  await expect(page.locator('#node-phrase')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#node-keyword')).toHaveAttribute('data-state', 'executed');
  await expect(page.locator('.edge[data-kind="answer"]')).toHaveAttribute('data-state', 'warning');
});

test('malformed response and rate limiting do not masquerade as no-answer', async ({ page }) => {
  await stubQueries(page, 'malformed');
  await runQuery(page);
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'error');
  await stubQueries(page, 'oversized');
  await runQuery(page);
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'error');
  await stubQueries(page, 'rate');
  await runQuery(page);
  await expect(page.locator('#glass-wall-error')).toContainText('límite de consultas');
});

test('source and query markup stays inert, and late requests cannot replace the latest result', async ({ page }) => {
  await stubQueries(page, 'markup');
  await runQuery(page, '<b data-injection-probe="true">consulta</b>');
  await expect(page.locator('.evidence-item')).toHaveCount(5);
  await expect(page.locator('[data-injection-probe]')).toHaveCount(0);
  await expect(page.locator('#evidence-1 h3')).toContainText('<b');
  await stubQueries(page, 'race');
  await runQuery(page, 'primera');
  await page.locator('#glass-wall-query').fill('segunda');
  await page.locator('#glass-wall-form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await expect(page.locator('#evidence-1 h3')).toContainText('segunda');
  await page.waitForTimeout(950);
  await expect(page.locator('#evidence-1 h3')).toContainText('segunda');
  await expect(page.locator('#node-query .node-value')).toHaveText('segunda');
});

test('keyboard, reduced-motion and forced-colors retain a readable directed map', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al mapa' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#glass-wall-graph')).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await stubQueries(page, 'success');
  await runQuery(page);
  await expect(page.locator('#metric-evidence-count')).toHaveText('5');
  await verifyGeometry(page);
  const styles = await page.locator('.edge').first().evaluate((el) => ({ animation: getComputedStyle(el).animationName, stroke: getComputedStyle(el).stroke }));
  expect(styles.animation).toBe('none');
  expect(styles.stroke).not.toBe('none');
});

test('a request that never completes leaves loading after the bounded timeout', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => { window.fetch = () => new Promise<Response>(() => {}); });
  await runQuery(page);
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'loading');
  await page.clock.fastForward(12001);
  await expect(page.locator('body')).toHaveAttribute('data-flow-state', 'error');
  await expect(page.locator('#glass-wall-submit')).toBeEnabled();
  await expect(page.locator('.evidence-item')).toHaveCount(0);
});

test('real frozen public corpus returns official citations without contacting the managed API', async ({ page }, testInfo) => {
  // Match the production Pages configuration while keeping the real frozen corpus and bridge.
  await page.route('**/glass-wall.html', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace('data-static-fallback="static-first"', 'data-static-fallback="static-first" data-api-url="https://la-muni-rag-public-gateway-ccaqcuwgyq-uc.a.run.app"');
    await route.fulfill({ response, body: html });
  });
  const remote: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).hostname.endsWith('run.app')) remote.push(request.url()); });
  await page.reload();
  await runQuery(page, 'agua potable');
  await expect(page.locator('#metric-evidence-count')).not.toHaveText('0');
  await expect(page.locator('#runtime-copy')).toContainText('Consulta local');
  expect(remote).toEqual([]);
  const links = await page.locator('.evidence-item a').evaluateAll((items) => items.map((item) => (item as HTMLAnchorElement).href));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(new URL(link).hostname).toBe('muniantigua.gob.gt');
  await verifyGeometry(page);
  await page.screenshot({ path: testInfo.outputPath('glass-wall-directed.png'), fullPage: true });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const relativeLuminance = (hex: string): number => {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid RGB hex: ${hex}`);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
};

const contrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
};

describe("public surface contrast tokens", () => {
  it("keeps normal, muted, and quiet text above WCAG AA contrast", async () => {
    const css = await readFile("public/product.css", "utf8");
    assert.match(css, /--bg:#f7f3ee/);
    assert.match(css, /--surface:#fffdf9/);
    assert.match(css, /--text:#282222/);
    assert.match(css, /--muted:#625b56/);
    assert.match(css, /--quiet:#786f69/);

    assert.ok(contrastRatio("282222", "f7f3ee") >= 4.5);
    assert.ok(contrastRatio("625b56", "fffdf9") >= 4.5);
    assert.ok(contrastRatio("786f69", "fffdf9") >= 4.5);
  });

  it("keeps the burgundy CTA readable with light action text", async () => {
    const css = await readFile("public/product.css", "utf8");
    assert.match(css, /--action:#731729/);
    assert.match(css, /--action-text:#fffdf9/);
    assert.ok(contrastRatio("fffdf9", "731729") >= 4.5);
  });

  it("keeps the explanatory panel on a predictable opaque paper background", async () => {
    const css = await readFile("public/product.css", "utf8");
    const glass = await readFile("public/liquid-glass.css", "utf8");
    assert.match(css, /\.evidence-dossier\{[^}]*background:var\(--surface\)/);
    assert.match(glass, /--glass-paper:#fffdf9/);
    assert.match(glass, /\.evidence-dossier\{background:var\(--glass-paper\)/);
    assert.match(glass, /prefers-reduced-transparency:reduce/);
    assert.ok(contrastRatio("625b56", "fffdf9") >= 4.5);
  });
});

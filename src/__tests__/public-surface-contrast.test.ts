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
  it("keeps normal text and muted text above WCAG AA contrast", async () => {
    const css = await readFile("public/product.css", "utf8");
    assert.match(css, /--bg:#070812/);
    assert.match(css, /--surface:#0d1224/);
    assert.match(css, /--text:#f8fafc/);
    assert.match(css, /--muted:#cbd5e1/);
    assert.match(css, /--quiet:#94a3b8/);

    assert.ok(contrastRatio("f8fafc", "070812") >= 4.5);
    assert.ok(contrastRatio("cbd5e1", "0d1224") >= 4.5);
    assert.ok(contrastRatio("94a3b8", "0d1224") >= 4.5);
  });

  it("keeps the reserved CTA color readable with dark action text", async () => {
    const css = await readFile("public/product.css", "utf8");
    assert.match(css, /--action:#67e8f9/);
    assert.match(css, /--action-text:#06202a/);
    assert.ok(contrastRatio("67e8f9", "06202a") >= 4.5);
  });

  it("keeps panel text on a predictable opaque background", async () => {
    const css = await readFile("public/product.css", "utf8");
    assert.match(css, /background:rgba\(6,9,22,\.94\)/);
    assert.ok(contrastRatio("cbd5e1", "060916") >= 4.5);
  });
});

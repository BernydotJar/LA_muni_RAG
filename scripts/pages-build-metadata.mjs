import { execFileSync } from "node:child_process";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export const normalizeBuildSha = (value, label = "build SHA") => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!SHA_PATTERN.test(normalized)) {
    throw new Error(`${label} must be a full 40-character lowercase hexadecimal Git SHA.`);
  }
  return normalized;
};

export const resolveBuildSha = () => {
  const explicit = process.env.PAGES_BUILD_SHA || process.env.GITHUB_SHA;
  if (explicit) return normalizeBuildSha(explicit, "PAGES_BUILD_SHA/GITHUB_SHA");
  const gitSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return normalizeBuildSha(gitSha, "git HEAD");
};

export const sanitizePagesOnlineUrl = (value) => {
  if (!value || !String(value).trim()) throw new Error("PAGES_ONLINE_URL is required.");
  const parsed = new URL(String(value).trim());
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    throw new Error("PAGES_ONLINE_URL must use HTTPS, except for loopback verification.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("PAGES_ONLINE_URL must not include credentials, query parameters, or fragments.");
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed.href;
};

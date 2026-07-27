import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { SecretProtector } from "./types.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export const sha256Hex = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export const randomOpaqueToken = (bytes = 32): string => {
  if (!Number.isSafeInteger(bytes) || bytes < 16 || bytes > 128) {
    throw new Error("Opaque token byte length is outside policy");
  }
  return randomBytes(bytes).toString("base64url");
};

export const pkceChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier, "ascii").digest("base64url");

export const digestsEqual = (left: string, right: string): boolean => {
  if (!SHA256_HEX.test(left) || !SHA256_HEX.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
};

const decodeKey = (value: string | Buffer): Buffer => {
  const key = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, "base64url");
  if (key.length !== 32) throw new Error("Human session protector key must be exactly 32 bytes");
  return key;
};

export class AesGcmSecretProtector implements SecretProtector {
  readonly kind = "aes-256-gcm" as const;
  private readonly key: Buffer;

  constructor(key: string | Buffer) {
    this.key = decodeKey(key);
  }

  seal(plaintext: string): string {
    if (plaintext.length < 1 || Buffer.byteLength(plaintext) > 4096) {
      throw new Error("Protected human session value is outside policy");
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
  }

  open(protectedValue: string): string {
    if (
      protectedValue.length < 40 ||
      protectedValue.length > 8192 ||
      !BASE64URL.test(protectedValue)
    ) {
      throw new Error("Protected human session value is invalid");
    }
    const value = Buffer.from(protectedValue, "base64url");
    if (value.length < 29) throw new Error("Protected human session value is invalid");
    const iv = value.subarray(0, 12);
    const tag = value.subarray(12, 28);
    const ciphertext = value.subarray(28);
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new Error("Protected human session value is invalid");
    }
  }
}

/** Explicitly insecure and deterministic. It exists only for executable tests. */
export class DeterministicTestSecretProtector implements SecretProtector {
  readonly kind = "test-only" as const;

  constructor(options: { allowInsecureTestOnly: true }) {
    if (options.allowInsecureTestOnly !== true || process.env.NODE_ENV === "production") {
      throw new Error("The deterministic secret protector is test-only");
    }
  }

  seal(plaintext: string): string {
    return `test.${Buffer.from(plaintext, "utf8").toString("base64url")}`;
  }

  open(protectedValue: string): string {
    if (!protectedValue.startsWith("test.")) throw new Error("Invalid test protected value");
    return Buffer.from(protectedValue.slice(5), "base64url").toString("utf8");
  }
}

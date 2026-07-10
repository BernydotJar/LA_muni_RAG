import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { HttpError } from "../http.js";

const bearerToken = (req: IncomingMessage): string | undefined => {
  const authorization = req.headers.authorization;
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim();
};

const constantTimeEqual = (actual: string, expected: string): boolean => {
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
};

export const requireProcedureFeedbackAuth = (
  req: IncomingMessage,
  configuredToken: string | undefined
): void => {
  const expected = configuredToken?.trim();
  if (!expected) {
    throw new HttpError(503, "feedback_api_disabled", "Procedure feedback API is not configured");
  }

  const actual = bearerToken(req);
  if (!actual || !constantTimeEqual(actual, expected)) {
    throw new HttpError(401, "feedback_unauthorized", "Valid Bearer token is required");
  }
};

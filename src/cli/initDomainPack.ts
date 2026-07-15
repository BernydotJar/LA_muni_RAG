import {
  DomainBootstrapError,
  initializeDomainPack,
  parseDomainInitArgs,
} from "../domain/bootstrap.js";

const fail = (error: unknown): never => {
  const code = error instanceof DomainBootstrapError ? error.code : "write_failed";
  const message =
    error instanceof DomainBootstrapError
      ? error.message
      : "domain pack initialization failed";
  console.error(JSON.stringify({ status: "error", code, message }, null, 
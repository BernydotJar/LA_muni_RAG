import {
  DomainBootstrapError,
  initializeDomainPack,
  parseDomainInitArgs,
} from "../domain/bootstrap.js";

const fail = (error: unknown): never => {
  const code = error instanceof DomainBootstrapError ? error.code : "write_failed";
  const message = error instanceof Error ? error.message : "unknown domain bootstrap error";
  console.error(JSON.stringify({ status: "error", code, message }, null, 2));
  process.exit(1);
};

try {
  const options = parseDomainInitArgs(process.argv.slice(2));
  const result = await initializeDomainPack(options, { workspaceRoot: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  fail(error);
}

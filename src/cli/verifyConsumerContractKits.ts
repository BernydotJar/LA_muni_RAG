import { pathToFileURL } from "node:url";
import { verifyAllConsumerContractKits } from "../integration/consumerContractKit.js";

export const runConsumerContractKitCli = async (projectRoot = process.cwd()): Promise<number> => {
  const result = await verifyAllConsumerContractKits(projectRoot);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return result.status === "valid" ? 0 : 1;
};

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  process.exitCode = await runConsumerContractKitCli();
}

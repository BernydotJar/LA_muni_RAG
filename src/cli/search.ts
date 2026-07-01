import "dotenv/config";
import { closeDb } from "../db.js";
import { keywordSearch, phraseSearch } from "../search.js";

const printUsage = (): void => {
  console.log(`
Usage:
  npm run search -- --keyword "ordenamiento territorial"
  npm run search -- --phrase "CNPAG"

Options:
  --keyword <text>   PostgreSQL full-text search with Spanish stemming
  --phrase <text>    Exact substring search
  --limit <number>   Result limit, default 10
`);
};

const args = process.argv.slice(2);

const readArg = (name: string): string | null => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const main = async (): Promise<void> => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set your password.");
  }

  const limitRaw = readArg("--limit");
  const limit = limitRaw ? Number(limitRaw) : 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("--limit must be an integer between 1 and 50");
  }

  const keyword = readArg("--keyword");
  const phrase = readArg("--phrase");

  if ((keyword && phrase) || (!keyword && !phrase)) {
    printUsage();
    return;
  }

  if (keyword) {
    const results = await keywordSearch(keyword, limit);
    console.log(JSON.stringify({ mode: "keyword", query: keyword, results }, null, 2));
    return;
  }

  if (phrase) {
    const results = await phraseSearch(phrase, limit);
    console.log(JSON.stringify({ mode: "phrase", query: phrase, results }, null, 2));
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });


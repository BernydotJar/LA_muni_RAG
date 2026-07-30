#!/usr/bin/env bash
set -euo pipefail

PG_BIN="/usr/lib/postgresql/15/bin"
DATABASE="la_muni_rag_real_corpus_test"
ADMIN_PASSWORD="controlled-admin-${RANDOM}-${RANDOM}-20260729"
RUNTIME_ROLE="la_muni_real_corpus_runtime"
RUNTIME_PASSWORD="controlled-runtime-${RANDOM}-${RANDOM}-20260729"
LIBRARY_ROOT="${CONTROLLED_CORPUS_LIBRARY_ROOT:-$(pwd)/.rag/library}"
CONFIG="${CONTROLLED_CORPUS_CONFIG:-evals/real-corpus/controlled-ingestion-config.json}"
TEMP_ROOT="$(mktemp -d /tmp/la-muni-real-corpus.XXXXXX)"
PGDATA="$TEMP_ROOT/pgdata"
SOCKET_DIR="$TEMP_ROOT/socket"
PWFILE="$TEMP_ROOT/admin-password"
PORT="$(python3 - <<'PY'
import socket
sock=socket.socket()
sock.bind(('127.0.0.1',0))
print(sock.getsockname()[1])
sock.close()
PY
)"
STARTED=0

cleanup() {
  if [[ "$STARTED" = "1" ]]; then
    runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT INT TERM

for command in psql node npm clamscan runuser; do
  command -v "$command" >/dev/null 2>&1 || { echo "required command unavailable: $command" >&2; exit 2; }
done
for binary in initdb pg_ctl postgres pg_isready; do
  [[ -x "$PG_BIN/$binary" ]] || { echo "required PostgreSQL binary unavailable: $binary" >&2; exit 2; }
done

mkdir -p "$LIBRARY_ROOT" "$PGDATA" "$SOCKET_DIR"
chmod 700 "$LIBRARY_ROOT"
cp .rag/source-inventory.json "$TEMP_ROOT/source-inventory.json"
printf '%s\n' "$ADMIN_PASSWORD" > "$PWFILE"
chown -R postgres:postgres "$TEMP_ROOT"
chmod 600 "$PWFILE"

CONTROLLED_CORPUS_SOURCE_INVENTORY="$TEMP_ROOT/source-inventory.json" \
CONTROLLED_CORPUS_LIBRARY_ROOT="$LIBRARY_ROOT" node scripts/acquire-controlled-real-corpus.mjs "$CONFIG" \
  > /tmp/la-muni-controlled-acquisition.json

runuser -u postgres -- "$PG_BIN/initdb" \
  -D "$PGDATA" \
  --username=postgres \
  --pwfile="$PWFILE" \
  --auth-local=trust \
  --auth-host=scram-sha-256 \
  --no-instructions >/dev/null
cat >> "$PGDATA/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = $PORT
unix_socket_directories = '$SOCKET_DIR'
fsync = off
synchronous_commit = off
full_page_writes = off
max_connections = 30
EOF
chown postgres:postgres "$PGDATA/postgresql.conf"
runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$TEMP_ROOT/postgres.log" start >/dev/null
STARTED=1
for _ in $(seq 1 60); do
  if PGPASSWORD="$ADMIN_PASSWORD" "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
PGPASSWORD="$ADMIN_PASSWORD" "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres >/dev/null

ADMIN_URL="postgresql://postgres:${ADMIN_PASSWORD}@127.0.0.1:${PORT}/${DATABASE}"
RUNTIME_URL="postgresql://${RUNTIME_ROLE}:${RUNTIME_PASSWORD}@127.0.0.1:${PORT}/${DATABASE}"
PGPASSWORD="$ADMIN_PASSWORD" psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DATABASE};" >/dev/null
for migration in $(find db/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
  PGPASSWORD="$ADMIN_PASSWORD" psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE" \
    -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done
PGPASSWORD="$ADMIN_PASSWORD" psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE" \
  -v ON_ERROR_STOP=1 \
  -v runtime_role="$RUNTIME_ROLE" \
  -v runtime_password="$RUNTIME_PASSWORD" \
  -f db/tests/controlled_real_corpus_setup.sql >/dev/null

npm run build >/dev/null
CONTROLLED_CORPUS_ACCEPTANCE_DATABASE_URL="$ADMIN_URL" \
CONTROLLED_CORPUS_RUNTIME_DATABASE_URL="$RUNTIME_URL" \
CONTROLLED_CORPUS_RUNTIME_ROLE="$RUNTIME_ROLE" \
CONTROLLED_CORPUS_LIBRARY_ROOT="$LIBRARY_ROOT" \
CONTROLLED_CORPUS_SOURCE_INVENTORY="$TEMP_ROOT/source-inventory.json" \
CONTROLLED_CORPUS_MANIFEST_PATH="$TEMP_ROOT/corpus-manifest.json" \
CONTROLLED_CORPUS_EVIDENCE_MANIFEST_PATH="$TEMP_ROOT/controlled-corpus-manifest.json" \
CONTROLLED_CORPUS_RECEIPT_PATH="$TEMP_ROOT/controlled-ingestion-receipt.json" \
DOCUMENT_MALWARE_SCANNER=clamscan \
DOCUMENT_MALWARE_SCANNER_COMMAND=clamscan \
DOCUMENT_MALWARE_SCAN_TIMEOUT_MS=600000 \
DOCUMENT_MAX_ARTIFACT_BYTES=104857600 \
PDF_EXTRACTION_MAX_INPUT_BYTES=104857600 \
PDF_EXTRACTION_TIMEOUT_MS=300000 \
PDF_EXTRACTION_MAX_PAGES=5000 \
PDF_EXTRACTION_MAX_TOTAL_TEXT_BYTES=33554432 \
PDF_EXTRACTION_MEMORY_MB=1024 \
node dist/cli/controlledCorpusIngestion.js --config "$CONFIG" \
  > /tmp/la-muni-controlled-ingestion.json

REAL_CORPUS_RETRIEVAL_DATABASE_URL="$RUNTIME_URL" \
REAL_CORPUS_RETRIEVAL_TENANT_ID="a7100000-0000-4000-8000-000000000001" \
node dist/cli/evaluateRealCorpusRetrieval.js evals/real-corpus/retrieval-cases.json \
  > /tmp/la-muni-real-corpus-retrieval-eval.json

PGPASSWORD="$RUNTIME_PASSWORD" psql -h 127.0.0.1 -p "$PORT" -U "$RUNTIME_ROLE" -d "$DATABASE" \
  -v ON_ERROR_STOP=1 -At <<'SQL' > /tmp/la-muni-controlled-db-verification.txt
BEGIN;
SELECT set_config('app.tenant_id', 'a7100000-0000-4000-8000-000000000001', true);
SELECT 'processed_versions=' || count(*) FROM rag.document_versions
 WHERE extraction_status = 'processed'
   AND id IN ('a7100000-0000-4000-8000-000000000011','a7100000-0000-4000-8000-000000000021');
SELECT 'vector_rows=' || count(*) FROM rag.embedding_vectors
 WHERE document_version_id IN ('a7100000-0000-4000-8000-000000000011','a7100000-0000-4000-8000-000000000021');
SELECT 'processed_jobs=' || count(*) FROM rag.ingestion_jobs WHERE status = 'processed';
SELECT 'failed_jobs=' || count(*) FROM rag.ingestion_jobs WHERE status = 'failed' AND last_error_code = 'pdf_no_extractable_text';
ROLLBACK;
SQL

grep -qx 'processed_versions=1' /tmp/la-muni-controlled-db-verification.txt
grep -Eq '^vector_rows=[1-9][0-9]*$' /tmp/la-muni-controlled-db-verification.txt
grep -qx 'processed_jobs=1' /tmp/la-muni-controlled-db-verification.txt
grep -qx 'failed_jobs=1' /tmp/la-muni-controlled-db-verification.txt
npm run corpus:verify:controlled

cat /tmp/la-muni-controlled-db-verification.txt
cat /tmp/la-muni-real-corpus-retrieval-eval.json

#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
MODULE_DIR="$SCRIPT_DIR/cloudsql-staging"
EXPECTED_BRANCH="feature/gcp-cloudsql-staging-v1"
RUNNER_SOURCE_HEAD="bd4d91c69bca895305411881218ec13a8bf3f90d"
PROJECT_ID="rag-municipalidades"
INSTANCE_NAME="la-muni-rag-staging"
INSTANCE_CONNECTION_NAME="$PROJECT_ID:us-central1:$INSTANCE_NAME"
AUTHORIZATION_ID="GCP-CLOUDSQL-MANAGED-RUN-20260725-1325-1725-GT"
AUTHORIZATION_PHRASE="RUN_APPROVED_LA_MUNI_GCP_STAGING_20260725_1325"
AUTHORIZATION_TIMEZONE="America/Guatemala"
AUTHORIZATION_START_LOCAL="2026-07-25 13:25:00"
AUTHORIZATION_END_LOCAL="2026-07-25 17:25:00"
PROXY_VERSION="2.23.0"
PROXY_AMD64_SHA256="cd689d582b826fa5bc82c01ccc14e45a58200c3cefbf923ce96c422825e4e6f6"
PROXY_ARM64_SHA256="23f63b36d1eda329a0751a5185f3ddbbfda1a5996846fcd5b408601e0981c963"
PROXY_PORT="5433"
OPERATOR_USER="la_muni_stage_20260725_1325"

fail() {
  printf 'REFUSED: %s\n' "$1" >&2
  exit 1
}

for command_name in bash curl date gcloud git grep jq node npm python3 seq sha256sum sort terraform timeout uname; do
  command -v "$command_name" >/dev/null 2>&1 || fail "required command not found: $command_name"
done

[[ "${FINAL_AUTHORIZATION:-}" == "$AUTHORIZATION_PHRASE" ]] || \
  fail "set FINAL_AUTHORIZATION=$AUTHORIZATION_PHRASE for this exact managed run"
[[ "$(git -C "$REPO_ROOT" branch --show-current)" == "$EXPECTED_BRANCH" ]] || fail "expected branch $EXPECTED_BRANCH"
[[ -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]] || fail "tracked worktree changes are present"
git -C "$REPO_ROOT" fetch --quiet origin "$EXPECTED_BRANCH"
local_head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
remote_head="$(git -C "$REPO_ROOT" rev-parse "origin/$EXPECTED_BRANCH")"
[[ "$local_head" == "$remote_head" ]] || fail "local HEAD is not aligned with origin/$EXPECTED_BRANCH"
git -C "$REPO_ROOT" cat-file -e "$RUNNER_SOURCE_HEAD^{commit}" || fail "runner source commit is unavailable"
if ! git -C "$REPO_ROOT" diff --quiet "$RUNNER_SOURCE_HEAD..HEAD" -- \
  package.json package-lock.json tsconfig.json migrations src/staging \
  src/cli/runEphemeralStaging.ts src/cli/verifyGcpCloudSqlStaging.ts src/gcp/cloudSqlStaging.ts; then
  fail "staging runner, migrations or preflight changed after authorization baseline"
fi

[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT_ID" ]] || fail "active GCP project is not $PROJECT_ID"
gcloud auth print-access-token >/dev/null 2>&1 || fail "no usable active gcloud authentication"

start_epoch="$(TZ="$AUTHORIZATION_TIMEZONE" date -d "$AUTHORIZATION_START_LOCAL" +%s)"
end_epoch="$(TZ="$AUTHORIZATION_TIMEZONE" date -d "$AUTHORIZATION_END_LOCAL" +%s)"
now_epoch="$(date +%s)"
if (( now_epoch < start_epoch || now_epoch >= end_epoch )); then
  fail "current time $(TZ="$AUTHORIZATION_TIMEZONE" date --iso-8601=seconds) is outside the authorized 13:25-17:25 window"
fi
remaining_seconds=$((end_epoch - now_epoch))
(( remaining_seconds >= 3600 )) || fail "less than one hour remains; do not start the managed run"

for required_file in backend.tf backend.gcs.hcl; do
  [[ -f "$MODULE_DIR/$required_file" ]] || fail "missing $MODULE_DIR/$required_file"
done
[[ ! -f "$MODULE_DIR/terraform.tfstate" ]] || fail "local terraform.tfstate exists"

terraform -chdir="$MODULE_DIR" init -input=false -reconfigure -backend-config=backend.gcs.hcl >/dev/null
mapfile -t state_addresses < <(terraform -chdir="$MODULE_DIR" state list | sort)
expected_addresses=("google_project_service.sqladmin[0]" "google_sql_database_instance.staging[0]")
[[ "${state_addresses[*]}" == "${expected_addresses[*]}" ]] || fail "remote Terraform state does not contain exactly the approved two addresses"

instance_json="$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format=json)"
jq -e '
  .state == "STOPPED"
  and .databaseVersion == "POSTGRES_16"
  and .region == "us-central1"
  and .settings.tier == "db-custom-1-3840"
  and .settings.activationPolicy == "NEVER"
  and .settings.deletionProtectionEnabled == true
  and .settings.userLabels.application == "la-muni-rag"
  and .settings.userLabels.environment == "staging"
  and .settings.userLabels."managed-by" == "terraform"
  and .settings.userLabels."data-class" == "synthetic-only"
  and .settings.userLabels.owner == "eduardo-sacahui"
' <<<"$instance_json" >/dev/null || fail "instance is not the expected protected stopped staging target"

run_stamp="$(TZ=UTC date +%Y%m%dT%H%M%SZ)"
artifact_dir="$MODULE_DIR/plan-artifacts/managed-run-$run_stamp"
mkdir -p "$artifact_dir"
chmod 700 "$artifact_dir"
printf '%s\n' "$instance_json" > "$artifact_dir/instance-before.json"
chmod 600 "$artifact_dir/instance-before.json"

proxy_pid=""
watchdog_pid=""
user_created=false
instance_started=false
cleanup_failed=false
operator_password="$(python3 -c 'import secrets; print(secrets.token_urlsafe(36))')"
proxy_dir="$(mktemp -d)"
proxy_log="$artifact_dir/proxy.log"
watchdog_log="$artifact_dir/watchdog.log"

wait_for_state() {
  local desired="$1" timeout_seconds="$2" deadline state
  deadline=$(( $(date +%s) + timeout_seconds ))
  while (( $(date +%s) < deadline )); do
    state="$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format='value(state)' 2>/dev/null || true)"
    [[ "$state" == "$desired" ]] && return 0
    sleep 10
  done
  return 1
}

cleanup() {
  local original_status=$?
  trap - EXIT INT TERM HUP
  set +e
  if [[ -n "$proxy_pid" ]]; then
    kill "$proxy_pid" 2>/dev/null
    wait "$proxy_pid" 2>/dev/null
  fi
  if [[ "$user_created" == true ]]; then
    gcloud sql users delete "$OPERATOR_USER" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --quiet >>"$artifact_dir/operator-cleanup.log" 2>&1 || cleanup_failed=true
  fi
  unset operator_password STAGING_ADMIN_DATABASE_URL
  if [[ "$instance_started" == true ]]; then
    gcloud sql instances patch "$INSTANCE_NAME" --project="$PROJECT_ID" --activation-policy=NEVER --quiet >>"$artifact_dir/stop.log" 2>&1 || cleanup_failed=true
    wait_for_state STOPPED 900 || cleanup_failed=true
  fi
  if [[ -n "$watchdog_pid" ]]; then
    kill "$watchdog_pid" 2>/dev/null
    wait "$watchdog_pid" 2>/dev/null
  fi
  gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format=json > "$artifact_dir/instance-final.json" 2>/dev/null || cleanup_failed=true
  gcloud sql operations list --project="$PROJECT_ID" --instance="$INSTANCE_NAME" --limit=30 --format=json > "$artifact_dir/operations.json" 2>/dev/null || cleanup_failed=true
  rm -rf -- "$proxy_dir"
  (cd "$artifact_dir" && sha256sum ./*.json ./*.log 2>/dev/null > SHA256SUMS) || true
  chmod 600 "$artifact_dir"/* 2>/dev/null || true
  if [[ "$cleanup_failed" == true ]]; then
    printf 'CLEANUP FAILURE: inspect %s and keep the instance stopped manually.\n' "$artifact_dir" >&2
    exit 1
  fi
  if (( original_status != 0 )); then
    printf 'Managed run failed safely; instance stop and temporary-user cleanup completed.\n' >&2
    printf 'Artifact directory: %s\n' "$artifact_dir" >&2
    exit "$original_status"
  fi
  printf 'Managed staging run completed and instance returned to STOPPED.\n'
  printf 'Artifact directory: %s\n' "$artifact_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

watchdog_delay=$((end_epoch - $(date +%s)))
nohup bash -c "sleep $watchdog_delay; gcloud sql instances patch '$INSTANCE_NAME' --project='$PROJECT_ID' --activation-policy=NEVER --quiet" >"$watchdog_log" 2>&1 &
watchdog_pid=$!

gcloud sql instances patch "$INSTANCE_NAME" --project="$PROJECT_ID" --activation-policy=ALWAYS --quiet >"$artifact_dir/start.log" 2>&1
instance_started=true
wait_for_state RUNNABLE 1200 || fail "instance did not become RUNNABLE within 20 minutes"

users_ready=false
for attempt in $(seq 1 30); do
  if gcloud sql users list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format='value(name)' \
    >"$artifact_dir/users-before.txt" 2>"$artifact_dir/users-list.stderr"; then
    users_ready=true
    break
  fi
  if grep -Eqi 'instance is not running|operation.*in progress|temporar|unavailable|timeout' "$artifact_dir/users-list.stderr"; then
    sleep 10
    continue
  fi
  cat "$artifact_dir/users-list.stderr" >&2
  fail "Cloud SQL users API failed with a non-transient error"
done
[[ "$users_ready" == true ]] || fail "Cloud SQL users API did not become ready within five minutes"

if grep -Fx "$OPERATOR_USER" "$artifact_dir/users-before.txt" >/dev/null; then
  gcloud sql users delete "$OPERATOR_USER" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --quiet \
    >"$artifact_dir/stale-operator-cleanup.log" 2>&1
fi

operator_created=false
for attempt in $(seq 1 12); do
  if gcloud sql users create "$OPERATOR_USER" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" \
    --password="$operator_password" --quiet >"$artifact_dir/operator-create.log" 2>&1; then
    operator_created=true
    user_created=true
    break
  fi
  if gcloud sql users list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format='value(name)' 2>/dev/null \
    | grep -Fx "$OPERATOR_USER" >/dev/null; then
    operator_created=true
    user_created=true
    break
  fi
  if grep -Eqi 'instance is not running|operation.*in progress|temporar|unavailable|timeout' "$artifact_dir/operator-create.log"; then
    sleep 10
    continue
  fi
  cat "$artifact_dir/operator-create.log" >&2
  fail "temporary operator creation failed with a non-transient error"
done
[[ "$operator_created" == true ]] || fail "temporary operator could not be created after retries"

case "$(uname -m)" in
  x86_64) proxy_arch=amd64; proxy_sha="$PROXY_AMD64_SHA256" ;;
  aarch64|arm64) proxy_arch=arm64; proxy_sha="$PROXY_ARM64_SHA256" ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac
proxy_bin="$proxy_dir/cloud-sql-proxy"
curl -fsSLo "$proxy_bin" "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v$PROXY_VERSION/cloud-sql-proxy.linux.$proxy_arch"
printf '%s  %s\n' "$proxy_sha" "$proxy_bin" | sha256sum -c - >/dev/null
chmod 700 "$proxy_bin"
"$proxy_bin" --version | grep -F "$PROXY_VERSION" >/dev/null || fail "unexpected Cloud SQL Auth Proxy version"

CSQL_PROXY_TOKEN="$(gcloud auth print-access-token)" \
  "$proxy_bin" --address=127.0.0.1 --port="$PROXY_PORT" "$INSTANCE_CONNECTION_NAME" >"$proxy_log" 2>&1 &
proxy_pid=$!
for _ in $(seq 1 60); do
  if grep -F 'ready for new connections' "$proxy_log" >/dev/null 2>&1; then break; fi
  kill -0 "$proxy_pid" 2>/dev/null || fail "Cloud SQL Auth Proxy exited before becoming ready"
  sleep 2
done
grep -F 'ready for new connections' "$proxy_log" >/dev/null || fail "Cloud SQL Auth Proxy did not become ready"

if [[ ! -x "$REPO_ROOT/node_modules/.bin/tsx" ]]; then
  npm --prefix "$REPO_ROOT" ci --ignore-scripts
fi
STAGING_ADMIN_DATABASE_URL="postgresql://$OPERATOR_USER:$operator_password@127.0.0.1:$PROXY_PORT/postgres"
export STAGING_ADMIN_DATABASE_URL
preflight_ready=false
preflight_attempt_log="$artifact_dir/preflight-attempts.log"
: >"$preflight_attempt_log"
for attempt in $(seq 1 24); do
  preflight_json_tmp="$proxy_dir/preflight-$attempt.json"
  preflight_error_tmp="$proxy_dir/preflight-$attempt.stderr"
  if GCP_CLOUDSQL_CONFIRM_STAGING=true npm --silent --prefix "$REPO_ROOT" run gcp:cloudsql:preflight \
    >"$preflight_json_tmp" 2>"$preflight_error_tmp"; then
    mv -- "$preflight_json_tmp" "$artifact_dir/preflight.json"
    preflight_ready=true
    break
  fi
  printf '%s\n' "--- preflight attempt $attempt ---" >>"$preflight_attempt_log"
  cat "$preflight_error_tmp" >>"$preflight_attempt_log"
  if grep -Eqi 'ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|server closed the connection|connection terminated|57P01' "$preflight_error_tmp"; then
    sleep 10
    continue
  fi
  cat "$preflight_error_tmp" >&2
  fail "Cloud SQL preflight failed with a non-transient error"
done
[[ "$preflight_ready" == true ]] || fail "Cloud SQL PostgreSQL connectivity did not become ready within four minutes"
jq -e '.status == "ready" and .postgresMajor == 16 and .vectorAvailable == true and .adminCapabilities == true and .cloudSqlDetected == true and .unrelatedDatabases == 0' "$artifact_dir/preflight.json" >/dev/null

run_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
run_budget=$((end_epoch - $(date +%s) - 900))
(( run_budget >= 900 )) || fail "insufficient time remains for run plus 15-minute stop buffer"
timeout --signal=TERM --kill-after=60s "$run_budget" \
  env STAGING_CONFIRM_EPHEMERAL=true STAGING_CLEAN_EXISTING=false STAGING_RUN_ID="$run_id" STAGING_ADMIN_DATABASE_URL="$STAGING_ADMIN_DATABASE_URL" \
  npm --silent --prefix "$REPO_ROOT" run staging:run > "$artifact_dir/staging-run.json"

jq -e '
  .status == "passed"
  and ([.journeys[] | select(.status == "passed")] | length) == 20
  and .browser.total == 12
  and .browser.blocked == 12
  and .cleanup.databases_destroyed == 4
  and .cleanup.roles_destroyed == 3
  and .cleanup.complete == true
' "$artifact_dir/staging-run.json" >/dev/null

printf '%s\n' "{\"authorization_id\":\"$AUTHORIZATION_ID\",\"run_id\":\"$run_id\",\"repository_head\":\"$local_head\",\"window_start\":\"2026-07-25T13:25:00-06:00\",\"window_end\":\"2026-07-25T17:25:00-06:00\",\"status\":\"passed\"}" > "$artifact_dir/authorization-receipt.json"

#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
MODULE_DIR="$SCRIPT_DIR/cloudsql-staging"
MODULE_RELATIVE="infra/gcp/cloudsql-staging"
EXPECTED_BRANCH="feature/gcp-cloudsql-staging-v1"
PROJECT_ID="rag-municipalidades"
INSTANCE_NAME="la-muni-rag-staging"
EXPECTED_TERRAFORM_VERSION="1.15.8"
PLAN_SOURCE_HEAD="e7c4393b0655d3c660941778ff47b1f31e6be57d"
ARTIFACT_BASENAME="approved-live-v2-e7c4393b0655-20260725T152522Z"
ARTIFACT_DIR="$MODULE_DIR/plan-artifacts/$ARTIFACT_BASENAME"
AUTHORIZATION_ID="GCP-CLOUDSQL-PILOT-20260725-0900-1300-GT"
AUTHORIZATION_PHRASE="APPLY_APPROVED_LA_MUNI_GCP_STAGING_20260725"
AUTHORIZATION_TIMEZONE="America/Guatemala"
AUTHORIZATION_START_LOCAL="2026-07-25 09:00:00"
AUTHORIZATION_END_LOCAL="2026-07-25 13:00:00"
EXPECTED_PLAN_SHA256="a9c16848cc89d68ad56de2d1344f3e6e20da0a4faca753a060d9a726aa09fe1e"
EXPECTED_JSON_SHA256="8e7a01cbc29bbce63c9d05b4a0935765cb6779afd05c7514cb8b7c0d8c0e106a"
EXPECTED_TEXT_SHA256="efd8f22358385c94f49f2edca40d141e38a274cbc10c47c0a7df1694577cc3e2"
EXPECTED_VERIFICATION_SHA256="d6b6a840b05b8ade30e1fca5408ec06d7f4f6ae923607c02b9f819a7baa1adce"

fail() {
  printf 'REFUSED: %s\n' "$1" >&2
  printf 'No Terraform apply was started by this script.\n' >&2
  exit 1
}

for command_name in date git gcloud terraform node jq sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || fail "required command not found: $command_name"
done

[[ "${FINAL_AUTHORIZATION:-}" == "$AUTHORIZATION_PHRASE" ]] || \
  fail "set FINAL_AUTHORIZATION=$AUTHORIZATION_PHRASE for this exact approved execution"

[[ "$(git -C "$REPO_ROOT" rev-parse --show-toplevel)" == "$REPO_ROOT" ]] || \
  fail "repository root verification failed"
[[ "$(git -C "$REPO_ROOT" branch --show-current)" == "$EXPECTED_BRANCH" ]] || \
  fail "expected branch $EXPECTED_BRANCH"
[[ -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]] || \
  fail "tracked worktree changes are present"

git -C "$REPO_ROOT" fetch --quiet origin "$EXPECTED_BRANCH"
local_head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
remote_head="$(git -C "$REPO_ROOT" rev-parse "origin/$EXPECTED_BRANCH")"
[[ "$local_head" == "$remote_head" ]] || fail "local HEAD is not aligned with origin/$EXPECTED_BRANCH"
git -C "$REPO_ROOT" cat-file -e "$PLAN_SOURCE_HEAD^{commit}" || fail "plan source commit is unavailable"

if ! git -C "$REPO_ROOT" diff --quiet "$PLAN_SOURCE_HEAD..HEAD" -- \
  "$MODULE_RELATIVE" \
  src/gcp/cloudSqlTerraformPlan.ts \
  src/cli/verifyGcpCloudSqlPlan.ts; then
  fail "Terraform module or plan verifier changed after the immutable plan was generated"
fi

[[ "$(gcloud config get-value project 2>/dev/null)" == "$PROJECT_ID" ]] || \
  fail "active GCP project is not $PROJECT_ID"
gcloud auth print-access-token >/dev/null 2>&1 || fail "no usable active gcloud authentication"

terraform_version="$(terraform version | awk 'NR == 1 { sub(/^Terraform v/, ""); print }')"
[[ "$terraform_version" == "$EXPECTED_TERRAFORM_VERSION" ]] || \
  fail "expected Terraform $EXPECTED_TERRAFORM_VERSION but found $terraform_version"

start_epoch="$(TZ="$AUTHORIZATION_TIMEZONE" date -d "$AUTHORIZATION_START_LOCAL" +%s)"
end_epoch="$(TZ="$AUTHORIZATION_TIMEZONE" date -d "$AUTHORIZATION_END_LOCAL" +%s)"
now_epoch="$(date +%s)"
if (( now_epoch < start_epoch || now_epoch >= end_epoch )); then
  now_local="$(TZ="$AUTHORIZATION_TIMEZONE" date --iso-8601=seconds)"
  fail "current time $now_local is outside the authorized 09:00-13:00 America/Guatemala window"
fi

for required_file in backend.tf backend.gcs.hcl; do
  [[ -f "$MODULE_DIR/$required_file" ]] || fail "missing $MODULE_DIR/$required_file"
done
[[ ! -f "$MODULE_DIR/terraform.tfstate" ]] || fail "local terraform.tfstate exists"
[[ -d "$ARTIFACT_DIR" ]] || fail "approved artifact directory not found: $ARTIFACT_DIR"

for artifact in \
  approved-live-v2.tfplan \
  approved-live-v2.tfplan.json \
  approved-live-v2.tfplan.txt \
  verification.json; do
  [[ -s "$ARTIFACT_DIR/$artifact" ]] || fail "approved artifact is missing or empty: $artifact"
done

(
  cd "$ARTIFACT_DIR"
  printf '%s  %s\n' \
    "$EXPECTED_PLAN_SHA256" approved-live-v2.tfplan \
    "$EXPECTED_JSON_SHA256" approved-live-v2.tfplan.json \
    "$EXPECTED_TEXT_SHA256" approved-live-v2.tfplan.txt \
    "$EXPECTED_VERIFICATION_SHA256" verification.json | sha256sum -c -
)

jq -e '
  .status == "valid"
  and (.issues | length) == 0
  and .summary.projectId == "rag-municipalidades"
  and .summary.instanceName == "la-muni-rag-staging"
  and .summary.region == "us-central1"
  and .summary.ownerLabel == "eduardo-sacahui"
  and .summary.estimatedComputeUsd == 0.351
  and .summary.deletionProtection == true
' "$ARTIFACT_DIR/verification.json" >/dev/null || fail "stored verification receipt is not valid"

runtime_verification="$(mktemp)"
trap 'rm -f -- "$runtime_verification"' EXIT
(
  cd "$REPO_ROOT"
  node --import tsx src/cli/verifyGcpCloudSqlPlan.ts \
    "$ARTIFACT_DIR/approved-live-v2.tfplan.json" \
    "$PROJECT_ID"
) > "$runtime_verification"
jq -e '.status == "valid" and (.issues | length) == 0' "$runtime_verification" >/dev/null || \
  fail "runtime plan verification failed"

terraform -chdir="$MODULE_DIR" init \
  -input=false \
  -reconfigure \
  -backend-config=backend.gcs.hcl

state_error="$(mktemp)"
trap 'rm -f -- "$runtime_verification" "$state_error"' EXIT
set +e
state_resources="$(terraform -chdir="$MODULE_DIR" state list 2>"$state_error")"
state_status=$?
set -e
if (( state_status != 0 )); then
  if grep -F 'No state file was found!' "$state_error" >/dev/null; then
    state_resources=""
  else
    cat "$state_error" >&2
    fail "unable to read the remote Terraform state"
  fi
fi
[[ -z "$state_resources" ]] || fail "remote state is no longer empty: $state_resources"

apply_started_at="$(TZ="$AUTHORIZATION_TIMEZONE" date --iso-8601=seconds)"
printf 'Authorization: %s\n' "$AUTHORIZATION_ID"
printf 'Plan source: %s\n' "$PLAN_SOURCE_HEAD"
printf 'Current repository HEAD: %s\n' "$local_head"
printf 'Authorized window: 2026-07-25 09:00-13:00 America/Guatemala\n'
printf 'Apply started at: %s\n' "$apply_started_at"
printf 'Applying exact plan SHA-256: %s\n' "$EXPECTED_PLAN_SHA256"

terraform -chdir="$MODULE_DIR" apply \
  -input=false \
  -lock-timeout=60s \
  -auto-approve \
  "$ARTIFACT_DIR/approved-live-v2.tfplan"

apply_completed_at="$(TZ="$AUTHORIZATION_TIMEZONE" date --iso-8601=seconds)"
terraform -chdir="$MODULE_DIR" output -json > "$ARTIFACT_DIR/post-apply-outputs.json"
chmod 600 "$ARTIFACT_DIR/post-apply-outputs.json"

gcloud sql instances describe "$INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --format='json(name,region,state,databaseVersion,settings.tier,settings.userLabels,settings.deletionProtectionEnabled)' \
  > "$ARTIFACT_DIR/cloudsql-instance-receipt.json"
chmod 600 "$ARTIFACT_DIR/cloudsql-instance-receipt.json"

jq -n \
  --arg authorization_id "$AUTHORIZATION_ID" \
  --arg plan_source_head "$PLAN_SOURCE_HEAD" \
  --arg execution_head "$local_head" \
  --arg plan_sha256 "$EXPECTED_PLAN_SHA256" \
  --arg started_at "$apply_started_at" \
  --arg completed_at "$apply_completed_at" \
  --arg window_end "2026-07-25T13:00:00-06:00" \
  '{
    authorization_id: $authorization_id,
    plan_source_head: $plan_source_head,
    execution_head: $execution_head,
    plan_sha256: $plan_sha256,
    apply_started_at: $started_at,
    apply_completed_at: $completed_at,
    authorized_window_end: $window_end,
    terraform_apply_executed: true,
    cloud_sql_instance_expected: true
  }' > "$ARTIFACT_DIR/apply-receipt.json"
chmod 600 "$ARTIFACT_DIR/apply-receipt.json"

(
  cd "$ARTIFACT_DIR"
  sha256sum post-apply-outputs.json cloudsql-instance-receipt.json apply-receipt.json \
    > APPLY-RECEIPT-SHA256SUMS
)
chmod 600 "$ARTIFACT_DIR/APPLY-RECEIPT-SHA256SUMS"

printf 'Approved Terraform apply completed at %s.\n' "$apply_completed_at"
printf 'The four-hour operational window ends at 2026-07-25T13:00:00-06:00.\n'
printf 'Proceed immediately to managed staging preflight, synthetic execution and teardown controls.\n'

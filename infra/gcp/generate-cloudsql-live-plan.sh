#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
MODULE_DIR="$SCRIPT_DIR/cloudsql-staging"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-feature/gcp-cloudsql-staging-v1}"
PROJECT_ID="${PROJECT_ID:-rag-municipalidades}"
OWNER_LABEL="${OWNER_LABEL:-eduardo-sacahui}"
EXPECTED_TERRAFORM_VERSION="${EXPECTED_TERRAFORM_VERSION:-1.15.8}"
TMP_DIR=""

usage() {
  cat <<'USAGE'
Usage: bash infra/gcp/generate-cloudsql-live-plan.sh

Generate and verify the corrected immutable Cloud SQL resource-bearing plan.
The script is self-locating and may be invoked from any working directory.
It never runs terraform apply.
USAGE
}

cleanup() {
  local status=$?
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf -- "$TMP_DIR"
  fi
  if [[ $status -ne 0 ]]; then
    printf 'Cloud SQL plan generation failed; no verified artifact was published. terraform apply was not run.\n' >&2
  fi
}
trap cleanup EXIT

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ $# -ne 0 ]]; then
  usage >&2
  exit 2
fi

for command_name in git gcloud terraform node npm sha256sum; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
done

if [[ "$(git -C "$REPO_ROOT" rev-parse --show-toplevel)" != "$REPO_ROOT" ]]; then
  printf 'Repository root verification failed: %s\n' "$REPO_ROOT" >&2
  exit 1
fi

current_branch="$(git -C "$REPO_ROOT" branch --show-current)"
if [[ "$current_branch" != "$EXPECTED_BRANCH" ]]; then
  printf 'Expected branch %s but found %s.\n' "$EXPECTED_BRANCH" "$current_branch" >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]]; then
  printf 'Tracked worktree changes are present; refusing to generate an approval artifact.\n' >&2
  exit 1
fi

git -C "$REPO_ROOT" fetch --quiet origin "$EXPECTED_BRANCH"
local_head="$(git -C "$REPO_ROOT" rev-parse HEAD)"
remote_head="$(git -C "$REPO_ROOT" rev-parse "origin/$EXPECTED_BRANCH")"
if [[ "$local_head" != "$remote_head" ]]; then
  printf 'Local HEAD is not aligned with origin/%s. Run git pull --ff-only first.\n' "$EXPECTED_BRANCH" >&2
  exit 1
fi

active_project="$(gcloud config get-value project 2>/dev/null)"
if [[ "$active_project" != "$PROJECT_ID" ]]; then
  printf 'Expected active GCP project %s but found %s.\n' "$PROJECT_ID" "$active_project" >&2
  exit 1
fi
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  printf 'No usable active gcloud authentication was found.\n' >&2
  exit 1
fi

terraform_version="$(terraform version | awk 'NR == 1 { sub(/^Terraform v/, ""); print }')"
if [[ "$terraform_version" != "$EXPECTED_TERRAFORM_VERSION" ]]; then
  printf 'Expected Terraform %s but found %s.\n' "$EXPECTED_TERRAFORM_VERSION" "$terraform_version" >&2
  exit 1
fi

for required_file in backend.tf backend.gcs.hcl; do
  if [[ ! -f "$MODULE_DIR/$required_file" ]]; then
    printf 'Missing %s. Run infra/gcp/bootstrap-controls.sh --check first.\n' "$MODULE_DIR/$required_file" >&2
    exit 1
  fi
done
if [[ -f "$MODULE_DIR/terraform.tfstate" ]]; then
  printf 'Local terraform.tfstate exists; refusing to continue.\n' >&2
  exit 1
fi

if [[ ! -d "$REPO_ROOT/node_modules/tsx" ]]; then
  npm --prefix "$REPO_ROOT" ci --ignore-scripts
fi

artifact_root="$MODULE_DIR/plan-artifacts"
rejected_dir="$artifact_root/rejected-missing-owner"
mkdir -p -- "$artifact_root" "$rejected_dir"
chmod 700 "$artifact_root" "$rejected_dir"

for filename in approved-live.tfplan approved-live.tfplan.json approved-live.tfplan.txt; do
  source_path="$MODULE_DIR/$filename"
  destination_path="$rejected_dir/$filename"
  if [[ -f "$source_path" ]]; then
    if [[ -e "$destination_path" ]]; then
      printf 'Rejected artifact destination already exists: %s\n' "$destination_path" >&2
      exit 1
    fi
    mv -- "$source_path" "$destination_path"
    chmod 600 "$destination_path"
  fi
done

head_short="$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD)"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact_dir="$artifact_root/approved-live-v2-${head_short}-${timestamp}"
if [[ -e "$artifact_dir" ]]; then
  printf 'Artifact directory already exists: %s\n' "$artifact_dir" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d "$artifact_root/.tmp-approved-live-v2.XXXXXX")"
chmod 700 "$TMP_DIR"
tmp_plan="$TMP_DIR/approved-live-v2.tfplan"
tmp_json="$TMP_DIR/approved-live-v2.tfplan.json"
tmp_text="$TMP_DIR/approved-live-v2.tfplan.txt"
tmp_verification="$TMP_DIR/verification.json"

labels_json="{\"application\":\"la-muni-rag\",\"environment\":\"staging\",\"managed-by\":\"terraform\",\"data-class\":\"synthetic-only\",\"owner\":\"$OWNER_LABEL\"}"

terraform -chdir="$MODULE_DIR" init \
  -input=false \
  -reconfigure \
  -backend-config=backend.gcs.hcl

terraform -chdir="$MODULE_DIR" plan \
  -input=false \
  -lock-timeout=60s \
  -out="$tmp_plan" \
  -var="project_id=$PROJECT_ID" \
  -var='connectivity_mode=AUTH_PROXY_PUBLIC' \
  -var='billing_approved=true' \
  -var='budget_approved=true' \
  -var='data_residency_approved=true' \
  -var='declared_pilot_budget_usd=1' \
  -var='reviewed_hourly_compute_usd=0.08775' \
  -var='max_pilot_runtime_hours=4' \
  -var="labels=$labels_json" \
  -var='allow_billable_resources=true' \
  -var='billable_confirmation=CREATE_LA_MUNI_GCP_STAGING'

terraform -chdir="$MODULE_DIR" show -json "$tmp_plan" > "$tmp_json"
(
  cd "$REPO_ROOT"
  node --import tsx src/cli/verifyGcpCloudSqlPlan.ts "$tmp_json" "$PROJECT_ID"
) | tee "$tmp_verification"
terraform -chdir="$MODULE_DIR" show -no-color "$tmp_plan" > "$tmp_text"

for artifact in "$tmp_plan" "$tmp_json" "$tmp_text" "$tmp_verification"; do
  if [[ ! -s "$artifact" ]]; then
    printf 'Expected non-empty artifact was not produced: %s\n' "$artifact" >&2
    exit 1
  fi
  chmod 600 "$artifact"
done

(
  cd "$TMP_DIR"
  sha256sum \
    approved-live-v2.tfplan \
    approved-live-v2.tfplan.json \
    approved-live-v2.tfplan.txt \
    verification.json > SHA256SUMS
)
chmod 600 "$TMP_DIR/SHA256SUMS"

mv -- "$TMP_DIR" "$artifact_dir"
TMP_DIR=""

printf 'Corrected immutable plan generated and verifier-approved.\n'
printf 'Artifact directory: %s\n' "$artifact_dir"
cat "$artifact_dir/SHA256SUMS"
printf 'terraform apply was not run.\n'

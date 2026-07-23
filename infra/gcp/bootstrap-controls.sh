#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_ID="${PROJECT_ID:-rag-municipalidades}"
EXPECTED_PROJECT_NUMBER="${EXPECTED_PROJECT_NUMBER:-1059368783280}"
REGION="${REGION:-us-central1}"
BUDGET_NAME="${BUDGET_NAME:-la-muni-rag-staging-pilot}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-}"
STATE_BUCKET="${TF_STATE_BUCKET:-la-muni-rag-tfstate-1059368783280}"
DEPLOYMENT_PRINCIPAL="${DEPLOYMENT_PRINCIPAL:-}"
MODE="${1:---check}"

fail() {
  echo "$1" >&2
  exit 2
}

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  fail "Usage: $0 [--check|--apply]"
fi
if [[ "$MODE" == "--apply" && "${GCP_BOOTSTRAP_CONFIRM:-}" != "APPLY_LA_MUNI_GCP_CONTROLS" ]]; then
  fail "Refusing mutation without GCP_BOOTSTRAP_CONFIRM=APPLY_LA_MUNI_GCP_CONTROLS"
fi
for command_name in gcloud jq; do
  command -v "$command_name" >/dev/null || fail "Missing $command_name"
done

active_account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n1)"
[[ -n "$active_account" ]] || fail "Run from an authenticated Google Cloud Shell."
project_number="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
[[ "$project_number" == "$EXPECTED_PROJECT_NUMBER" ]] || fail "Project number mismatch."
billing_account_name="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)')"
[[ -n "$billing_account_name" ]] || fail "Billing account is not linked."
billing_account_id="${billing_account_name#billingAccounts/}"
billing_currency="$(gcloud billing accounts describe "$billing_account_id" --format='value(currencyCode)')"
[[ -n "$billing_currency" ]] || fail "Unable to determine billing-account currency."
if [[ -z "$BUDGET_AMOUNT" ]]; then
  case "$billing_currency" in
    USD)
      BUDGET_AMOUNT="1USD"
      ;;
    COP)
      BUDGET_AMOUNT="4000COP"
      ;;
    *)
      fail "Billing currency is $billing_currency. Set BUDGET_AMOUNT to the approved account-currency pilot amount."
      ;;
  esac
fi
[[ "$BUDGET_AMOUNT" == *"$billing_currency" ]] || fail "BUDGET_AMOUNT=$BUDGET_AMOUNT must use billing-account currency $billing_currency."
budget_units="${BUDGET_AMOUNT%$billing_currency}"
[[ "$budget_units" =~ ^[0-9]+$ ]] || fail "BUDGET_AMOUNT must be an integer amount followed by $billing_currency."

services=(cloudbilling.googleapis.com cloudresourcemanager.googleapis.com billingbudgets.googleapis.com serviceusage.googleapis.com storage.googleapis.com)
if [[ "$MODE" == "--apply" ]]; then
  gcloud services enable "${services[@]}" --project="$PROJECT_ID" --quiet
fi

echo "Active account: $active_account"
echo "Project: $PROJECT_ID ($project_number)"
echo "Billing account: $billing_account_id ($billing_currency)"
echo "Approved budget amount: $BUDGET_AMOUNT"

project_owners="$(gcloud projects get-iam-policy "$PROJECT_ID" --flatten='bindings[].members' --filter='bindings.role=roles/owner' --format='value(bindings.members)' | sort -u)"
echo "Project owners:"
printf '%s\n' "$project_owners"
owner_count="$(printf '%s\n' "$project_owners" | sed '/^$/d' | wc -l | tr -d ' ')"
if [[ "$owner_count" -lt 2 ]]; then
  echo "WARNING: only $owner_count project owner is configured; owner redundancy remains open." >&2
fi

echo "Billing Account Administrators:"
gcloud billing accounts get-iam-policy "$billing_account_id" --flatten='bindings[].members' --filter='bindings.role=roles/billing.admin' --format='value(bindings.members)' | sort -u

echo "Effective resource-location policy:"
resource_location_policy="$(gcloud resource-manager org-policies describe gcp.resourceLocations --project="$PROJECT_ID" --effective --format=json 2>/dev/null || true)"
[[ -n "$resource_location_policy" ]] || fail "Unable to retrieve the effective gcp.resourceLocations policy."
printf '%s\n' "$resource_location_policy" | jq .
if ! jq -e '
  ((.listPolicy.allValues // "") == "ALLOW") or
  any(.spec.rules[]?; (.allowAll // false) == true) or
  (
    ([.spec.rules[]? | select(.condition != null)] | length) == 0 and
    ([.listPolicy.allowedValues[]?, .spec.rules[]?.values.allowedValues[]?] |
      any(. == "us-central1" or . == "in:us-central1-locations" or . == "in:us-locations"))
  )
' >/dev/null <<<"$resource_location_policy"; then
  fail "Effective resource-location policy requires manual review before us-central1 can be approved."
fi

budget_resource="$(gcloud billing budgets list --billing-account="$billing_account_id" --filter="displayName=$BUDGET_NAME" --format='value(name)' --limit=1 2>/dev/null || true)"
if [[ -z "$budget_resource" && "$MODE" == "--apply" ]]; then
  gcloud billing budgets create \
    --billing-account="$billing_account_id" \
    --display-name="$BUDGET_NAME" \
    --budget-amount="$BUDGET_AMOUNT" \
    --filter-projects="projects/$PROJECT_ID" \
    --calendar-period=month \
    --ownership-scope=billing-account \
    --threshold-rule=percent=0.50,basis=current-spend \
    --threshold-rule=percent=0.90,basis=current-spend \
    --threshold-rule=percent=1.00,basis=current-spend \
    --quiet
  budget_resource="$(gcloud billing budgets list --billing-account="$billing_account_id" --filter="displayName=$BUDGET_NAME" --format='value(name)' --limit=1)"
fi
[[ -n "$budget_resource" ]] || fail "Budget missing; use --apply after review."
budget_json="$(gcloud billing budgets describe "$budget_resource" --format=json)"
if ! jq -e \
  --arg name "$BUDGET_NAME" \
  --arg currency "$billing_currency" \
  --arg units "$budget_units" \
  --arg project_id "projects/$PROJECT_ID" \
  --arg project_number "projects/$EXPECTED_PROJECT_NUMBER" '
  .displayName == $name and
  .amount.specifiedAmount.currencyCode == $currency and
  ((.amount.specifiedAmount.units | tostring) == $units) and
  ((.amount.specifiedAmount.nanos // 0) == 0) and
  .budgetFilter.calendarPeriod == "MONTH" and
  (((.budgetFilter.projects // []) | index($project_id)) != null or
   ((.budgetFilter.projects // []) | index($project_number)) != null) and
  ((.allUpdatesRule.disableDefaultIamRecipients // false) == false) and
  (([.thresholdRules[]? |
      select((.spendBasis // "CURRENT_SPEND") == "CURRENT_SPEND") |
      .thresholdPercent] | sort) == [0.5, 0.9, 1])
' >/dev/null <<<"$budget_json"; then
  printf '%s\n' "$budget_json" | jq . >&2
  fail "Budget exists but its amount, scope, period, recipients or thresholds do not match the approved control."
fi
echo "Budget verified: $budget_resource"

bucket_url="gs://$STATE_BUCKET"
if ! gcloud storage buckets describe "$bucket_url" --project="$PROJECT_ID" >/dev/null 2>&1 && [[ "$MODE" == "--apply" ]]; then
  gcloud storage buckets create "$bucket_url" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --soft-delete-duration=7d
fi
if ! gcloud storage buckets describe "$bucket_url" --project="$PROJECT_ID" >/dev/null 2>&1; then
  fail "State bucket missing; use --apply after review."
fi

if [[ "$MODE" == "--apply" ]]; then
  gcloud storage buckets update "$bucket_url" \
    --project="$PROJECT_ID" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --versioning \
    --update-labels=application=la-muni-rag,environment=staging,managed-by=terraform,owner=eduardo-sacahui
  if [[ -n "$DEPLOYMENT_PRINCIPAL" ]]; then
    gcloud storage buckets add-iam-policy-binding "$bucket_url" \
      --member="$DEPLOYMENT_PRINCIPAL" \
      --role=roles/storage.objectAdmin \
      --project="$PROJECT_ID" \
      --quiet
  fi

  legacy_bindings=(
    "projectEditor:$PROJECT_ID|roles/storage.legacyBucketOwner"
    "projectOwner:$PROJECT_ID|roles/storage.legacyBucketOwner"
    "projectViewer:$PROJECT_ID|roles/storage.legacyBucketReader"
    "projectEditor:$PROJECT_ID|roles/storage.legacyObjectOwner"
    "projectOwner:$PROJECT_ID|roles/storage.legacyObjectOwner"
    "projectViewer:$PROJECT_ID|roles/storage.legacyObjectReader"
  )
  for binding in "${legacy_bindings[@]}"; do
    member="${binding%%|*}"
    role="${binding#*|}"
    gcloud storage buckets remove-iam-policy-binding "$bucket_url" \
      --member="$member" \
      --role="$role" \
      --project="$PROJECT_ID" \
      --quiet >/dev/null 2>&1 || true
  done
fi

bucket_json="$(gcloud storage buckets describe "$bucket_url" --project="$PROJECT_ID" --format=json)"
expected_location="${REGION^^}"
if ! jq -e \
  --arg location "$expected_location" '
  .location == $location and
  .default_storage_class == "STANDARD" and
  .public_access_prevention == "enforced" and
  .uniform_bucket_level_access == true and
  .versioning_enabled == true and
  ((.soft_delete_policy.retentionDurationSeconds | tonumber) >= 604800) and
  .labels.application == "la-muni-rag" and
  .labels.environment == "staging" and
  .labels["managed-by"] == "terraform" and
  .labels.owner == "eduardo-sacahui"
' >/dev/null <<<"$bucket_json"; then
  printf '%s\n' "$bucket_json" | jq . >&2
  fail "State bucket configuration does not match the approved controls."
fi

bucket_policy_json="$(gcloud storage buckets get-iam-policy "$bucket_url" --project="$PROJECT_ID" --format=json)"
if ! jq -e '([.bindings[]? | select(.role | startswith("roles/storage.legacy"))] | length) == 0' >/dev/null <<<"$bucket_policy_json"; then
  printf '%s\n' "$bucket_policy_json" | jq . >&2
  fail "Legacy project-convenience bindings remain on the state bucket; rerun --apply to harden IAM."
fi
if [[ -n "$DEPLOYMENT_PRINCIPAL" ]]; then
  if ! jq -e --arg principal "$DEPLOYMENT_PRINCIPAL" '
    any(.bindings[]?;
      .role == "roles/storage.objectAdmin" and
      any(.members[]?; . == $principal))
  ' >/dev/null <<<"$bucket_policy_json"; then
    printf '%s\n' "$bucket_policy_json" | jq . >&2
    fail "DEPLOYMENT_PRINCIPAL does not have roles/storage.objectAdmin on the state bucket."
  fi
else
  echo "WARNING: DEPLOYMENT_PRINCIPAL is unset; deployment-principal access was not verified." >&2
fi

printf '%s\n' "$bucket_json" | jq .
cat > "$ROOT_DIR/infra/gcp/cloudsql-staging/backend.gcs.hcl" <<BACKEND
bucket = "$STATE_BUCKET"
prefix = "cloudsql-staging"
BACKEND
chmod 600 "$ROOT_DIR/infra/gcp/cloudsql-staging/backend.gcs.hcl"

echo "Administrative controls verified. Cloud SQL was not created. terraform apply was not run."

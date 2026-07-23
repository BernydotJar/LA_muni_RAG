#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-rag-municipalidades}"
EXPECTED_PROJECT_NUMBER="${EXPECTED_PROJECT_NUMBER:-1059368783280}"
REGION="${REGION:-us-central1}"
BUDGET_NAME="${BUDGET_NAME:-la-muni-rag-staging-usd-1}"
STATE_BUCKET="${TF_STATE_BUCKET:-la-muni-rag-tfstate-1059368783280}"
MODE="${1:---check}"

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--check|--apply]" >&2
  exit 2
fi
if [[ "$MODE" == "--apply" && "${GCP_BOOTSTRAP_CONFIRM:-}" != "APPLY_LA_MUNI_GCP_CONTROLS" ]]; then
  echo "Refusing mutation without GCP_BOOTSTRAP_CONFIRM=APPLY_LA_MUNI_GCP_CONTROLS" >&2
  exit 2
fi
for command_name in gcloud jq; do
  command -v "$command_name" >/dev/null || { echo "Missing $command_name" >&2; exit 2; }
done

active_account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n1)"
[[ -n "$active_account" ]] || { echo "Run from an authenticated Google Cloud Shell." >&2; exit 2; }
project_number="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
[[ "$project_number" == "$EXPECTED_PROJECT_NUMBER" ]] || { echo "Project number mismatch." >&2; exit 2; }
billing_account_name="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)')"
[[ -n "$billing_account_name" ]] || { echo "Billing account is not linked." >&2; exit 2; }
billing_account_id="${billing_account_name#billingAccounts/}"

services=(cloudbilling.googleapis.com cloudresourcemanager.googleapis.com billingbudgets.googleapis.com serviceusage.googleapis.com storage.googleapis.com)
if [[ "$MODE" == "--apply" ]]; then
  gcloud services enable "${services[@]}" --project="$PROJECT_ID" --quiet
fi

echo "Active account: $active_account"
echo "Project: $PROJECT_ID ($project_number)"
echo "Billing account: $billing_account_id"

echo "Project owners:"
gcloud projects get-iam-policy "$PROJECT_ID" --flatten='bindings[].members' --filter='bindings.role=roles/owner' --format='value(bindings.members)' | sort -u

echo "Billing Account Administrators:"
gcloud billing accounts get-iam-policy "$billing_account_id" --flatten='bindings[].members' --filter='bindings.role=roles/billing.admin' --format='value(bindings.members)' | sort -u

echo "Relevant organization policies:"
gcloud resource-manager org-policies list --project="$PROJECT_ID" --format=json 2>/dev/null | jq '[.[] | select((.constraint // .name // "") | test("gcp.resourceLocations|storage.uniformBucketLevelAccess|storage.publicAccessPrevention"))]' || true

budget_resource="$(gcloud billing budgets list --billing-account="$billing_account_id" --filter="displayName=$BUDGET_NAME" --format='value(name)' --limit=1 2>/dev/null || true)"
if [[ -z "$budget_resource" && "$MODE" == "--apply" ]]; then
  gcloud billing budgets create \
    --billing-account="$billing_account_id" \
    --display-name="$BUDGET_NAME" \
    --budget-amount=1USD \
    --filter-projects="projects/$PROJECT_ID" \
    --calendar-period=month \
    --ownership-scope=billing-account \
    --threshold-rule=percent=0.50,basis=current-spend \
    --threshold-rule=percent=0.90,basis=current-spend \
    --threshold-rule=percent=1.00,basis=current-spend \
    --quiet
  budget_resource="$(gcloud billing budgets list --billing-account="$billing_account_id" --filter="displayName=$BUDGET_NAME" --format='value(name)' --limit=1)"
fi
[[ -n "$budget_resource" ]] && echo "Budget: $budget_resource" || echo "Budget missing; use --apply after review." >&2

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
if gcloud storage buckets describe "$bucket_url" --project="$PROJECT_ID" >/dev/null 2>&1; then
  if [[ "$MODE" == "--apply" ]]; then
    gcloud storage buckets update "$bucket_url" \
      --project="$PROJECT_ID" \
      --uniform-bucket-level-access \
      --public-access-prevention \
      --versioning \
      --update-labels=application=la-muni-rag,environment=staging,managed-by=terraform,owner=eduardo-sacahui
  fi
  gcloud storage buckets describe "$bucket_url" --project="$PROJECT_ID" --format=json
  cat > infra/gcp/cloudsql-staging/backend.gcs.hcl <<BACKEND
bucket = "$STATE_BUCKET"
prefix = "cloudsql-staging"
BACKEND
  chmod 600 infra/gcp/cloudsql-staging/backend.gcs.hcl
else
  echo "State bucket missing; use --apply after review." >&2
fi

echo "Cloud SQL was not created. terraform apply was not run."

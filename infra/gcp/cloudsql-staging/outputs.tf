output "resources_enabled" {
  description = "True only when the billable gate, exact confirmation and all approvals are set."
  value       = local.create_resources
}

output "instance_connection_name" {
  description = "Cloud SQL connection name for Auth Proxy or a language connector."
  value       = try(google_sql_database_instance.staging[0].connection_name, null)
}

output "connectivity_mode" {
  description = "Selected connection boundary."
  value       = var.connectivity_mode
}

output "deletion_protection_enabled" {
  description = "Terraform and Cloud SQL deletion-protection state."
  value       = !var.allow_destroy
}

output "declared_pilot_budget_usd" {
  description = "Declared pilot budget used by the plan guard; this is not a GCP hard spending cap."
  value       = var.declared_pilot_budget_usd
}

output "estimated_pilot_compute_usd" {
  description = "Reviewed compute and memory estimate for the bounded pilot window, excluding storage, backups and network."
  value       = local.estimated_pilot_compute_usd
}

output "max_pilot_runtime_hours" {
  description = "Maximum approved pilot runtime window before stop or teardown review."
  value       = var.max_pilot_runtime_hours
}

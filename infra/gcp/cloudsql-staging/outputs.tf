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

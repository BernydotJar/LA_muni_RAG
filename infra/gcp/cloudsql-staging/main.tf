locals {
  creation_confirmed          = nonsensitive(var.billable_confirmation) == "CREATE_LA_MUNI_GCP_STAGING"
  estimated_pilot_compute_usd = var.reviewed_hourly_compute_usd * var.max_pilot_runtime_hours
  pilot_cost_review_complete  = var.declared_pilot_budget_usd > 0 && var.reviewed_hourly_compute_usd > 0 && local.estimated_pilot_compute_usd <= var.declared_pilot_budget_usd
  approvals_complete          = var.billing_approved && var.budget_approved && var.data_residency_approved && local.pilot_cost_review_complete
  destroy_confirmed           = !var.allow_destroy || nonsensitive(var.destroy_confirmation) == "DESTROY_LA_MUNI_GCP_STAGING"
  create_resources            = var.allow_billable_resources && local.creation_confirmed && local.approvals_complete
  use_private_ip              = var.connectivity_mode == "PRIVATE"
  use_public_proxy            = var.connectivity_mode == "AUTH_PROXY_PUBLIC"
}

resource "google_project_service" "sqladmin" {
  count = local.create_resources ? 1 : 0

  project            = var.project_id
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

resource "google_sql_database_instance" "staging" {
  count = local.create_resources ? 1 : 0

  project          = var.project_id
  name             = var.instance_name
  region           = var.region
  database_version = var.database_version

  deletion_protection = !var.allow_destroy

  settings {
    edition               = var.edition
    tier                  = var.tier
    availability_type     = "ZONAL"
    disk_type             = "PD_SSD"
    disk_size             = var.disk_size_gb
    disk_autoresize       = true
    disk_autoresize_limit = var.disk_autoresize_limit_gb

    user_labels                 = var.labels
    deletion_protection_enabled = !var.allow_destroy
    connector_enforcement       = "REQUIRED"
    data_api_access             = "DISALLOW_DATA_API"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = var.backup_start_time
      transaction_log_retention_days = var.transaction_log_retention_days

      backup_retention_settings {
        retained_backups = var.retained_backups
        retention_unit   = "COUNT"
      }
    }

    ip_configuration {
      ipv4_enabled                                  = local.use_public_proxy
      private_network                               = local.use_private_ip ? var.private_network_self_link : null
      enable_private_path_for_google_cloud_services = local.use_private_ip
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    maintenance_window {
      day          = 7
      hour         = 6
      update_track = "stable"
    }
  }

  lifecycle {
    precondition {
      condition     = local.creation_confirmed
      error_message = "billable_confirmation must equal CREATE_LA_MUNI_GCP_STAGING."
    }
    precondition {
      condition     = local.approvals_complete
      error_message = "Billing, budget, data-residency and bounded pilot cost review must all be complete."
    }
    precondition {
      condition     = local.destroy_confirmed
      error_message = "destroy_confirmation must equal DESTROY_LA_MUNI_GCP_STAGING when allow_destroy is true."
    }
    precondition {
      condition     = !local.use_private_ip || var.private_network_self_link != null
      error_message = "private_network_self_link is required for PRIVATE connectivity."
    }
    precondition {
      condition     = !local.use_public_proxy || var.private_network_self_link == null
      error_message = "AUTH_PROXY_PUBLIC must not configure a private network."
    }
  }

  depends_on = [google_project_service.sqladmin]
}

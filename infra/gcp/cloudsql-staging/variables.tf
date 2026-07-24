variable "project_id" {
  description = "Existing GCP project approved for non-production billable staging."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid existing GCP project id."
  }
}

variable "region" {
  description = "Approved Cloud SQL region."
  type        = string
  default     = "us-central1"

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.region))
    error_message = "region must look like a GCP region, for example us-central1."
  }
}

variable "instance_name" {
  description = "Unique non-production Cloud SQL instance name."
  type        = string
  default     = "la-muni-rag-staging"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,61}[a-z0-9]$", var.instance_name))
    error_message = "instance_name must be a lowercase Cloud SQL instance id."
  }
}

variable "database_version" {
  description = "PostgreSQL major pinned to the version exercised by repository CI."
  type        = string
  default     = "POSTGRES_16"

  validation {
    condition     = var.database_version == "POSTGRES_16"
    error_message = "Feature 074 permits POSTGRES_16 only."
  }
}

variable "edition" {
  description = "Enterprise is explicit so the custom staging tier is valid on PostgreSQL 16."
  type        = string
  default     = "ENTERPRISE"

  validation {
    condition     = var.edition == "ENTERPRISE"
    error_message = "Feature 074 permits ENTERPRISE only."
  }
}

variable "tier" {
  description = "Small production-shaped staging tier; change requires review and cost approval."
  type        = string
  default     = "db-custom-1-3840"
}

variable "connectivity_mode" {
  description = "PRIVATE is the target. AUTH_PROXY_PUBLIC is an explicit pilot exception with no authorized networks."
  type        = string
  default     = "PRIVATE"

  validation {
    condition     = contains(["PRIVATE", "AUTH_PROXY_PUBLIC"], var.connectivity_mode)
    error_message = "connectivity_mode must be PRIVATE or AUTH_PROXY_PUBLIC."
  }
}

variable "private_network_self_link" {
  description = "VPC self link required when connectivity_mode is PRIVATE."
  type        = string
  default     = null
  nullable    = true
}

variable "disk_size_gb" {
  description = "Initial SSD size. Cloud SQL storage cannot be reduced."
  type        = number
  default     = 20

  validation {
    condition     = var.disk_size_gb >= 10 && var.disk_size_gb <= 100
    error_message = "disk_size_gb must be between 10 and 100 for staging."
  }
}

variable "disk_autoresize_limit_gb" {
  description = "Hard staging storage growth ceiling."
  type        = number
  default     = 100

  validation {
    condition     = var.disk_autoresize_limit_gb >= var.disk_size_gb && var.disk_autoresize_limit_gb <= 250
    error_message = "disk_autoresize_limit_gb must cover the initial disk and remain <= 250."
  }
}

variable "backup_start_time" {
  description = "UTC start time for automated backups."
  type        = string
  default     = "03:00"

  validation {
    condition     = can(regex("^(?:[01][0-9]|2[0-3]):[0-5][0-9]$", var.backup_start_time))
    error_message = "backup_start_time must use HH:MM UTC."
  }
}

variable "transaction_log_retention_days" {
  description = "PITR transaction log window for staging."
  type        = number
  default     = 3

  validation {
    condition     = var.transaction_log_retention_days >= 1 && var.transaction_log_retention_days <= 7
    error_message = "transaction_log_retention_days must be between 1 and 7."
  }
}

variable "retained_backups" {
  description = "Count-based retained automated backups."
  type        = number
  default     = 7

  validation {
    condition     = var.retained_backups >= 3 && var.retained_backups <= 14
    error_message = "retained_backups must be between 3 and 14."
  }
}

variable "allow_billable_resources" {
  description = "Human gate. False produces zero resources."
  type        = bool
  default     = false
}

variable "billable_confirmation" {
  description = "Must exactly equal CREATE_LA_MUNI_GCP_STAGING before resources can be planned."
  type        = string
  default     = ""
  sensitive   = true
}

variable "billing_approved" {
  description = "Human attestation that the existing project and billing owner approved this staging spend."
  type        = bool
  default     = false
}

variable "budget_approved" {
  description = "Human attestation that a monthly staging budget and alerts were approved."
  type        = bool
  default     = false
}

variable "data_residency_approved" {
  description = "Human attestation that the selected region and non-production data classification were approved."
  type        = bool
  default     = false
}

variable "declared_pilot_budget_usd" {
  description = "Maximum human-approved pilot budget. This is a plan guard, not a GCP hard spending cap."
  type        = number
  default     = 0

  validation {
    condition     = var.declared_pilot_budget_usd >= 0 && var.declared_pilot_budget_usd <= 500
    error_message = "declared_pilot_budget_usd must be between 0 and 500."
  }
}

variable "reviewed_hourly_compute_usd" {
  description = "Reviewed hourly Cloud SQL compute and memory estimate for the selected tier and region."
  type        = number
  default     = 0

  validation {
    condition     = var.reviewed_hourly_compute_usd >= 0 && var.reviewed_hourly_compute_usd <= 10
    error_message = "reviewed_hourly_compute_usd must be between 0 and 10."
  }
}

variable "max_pilot_runtime_hours" {
  description = "Maximum approved runtime window for the cost-bounded pilot before stop or teardown review."
  type        = number
  default     = 4

  validation {
    condition     = var.max_pilot_runtime_hours > 0 && var.max_pilot_runtime_hours <= 24
    error_message = "max_pilot_runtime_hours must be greater than 0 and no more than 24."
  }
}

variable "allow_destroy" {
  description = "Human gate for disabling deletion protection before an intentional destroy."
  type        = bool
  default     = false
}

variable "destroy_confirmation" {
  description = "Must exactly equal DESTROY_LA_MUNI_GCP_STAGING when allow_destroy is true."
  type        = string
  default     = ""
  sensitive   = true
}

variable "labels" {
  description = "Non-sensitive resource labels."
  type        = map(string)
  default = {
    application = "la-muni-rag"
    environment = "staging"
    managed-by  = "terraform"
    data-class  = "synthetic-only"
  }
}

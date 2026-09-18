target "docker-metadata-action-timekeeper" {}
target "docker-metadata-action-user" {}
target "docker-metadata-action-timesync" {}
target "docker-metadata-action-frontend" {}

variable "ACTIONS_RESULTS_URL" {
  default = ""
}

variable "ACTIONS_RUNTIME_TOKEN" {
  default = ""
}

target "sccache-secrets" {
  # Use GitHub's cache only when its runtime credentials are available.
  # Local builds use the Dockerfile's disk cache mount. CI validates both
  # variables before Bake; credentials are passed only as BuildKit secrets.
  args = {
    SCCACHE_GHA_ENABLED = ACTIONS_RESULTS_URL != "" && ACTIONS_RUNTIME_TOKEN != "" ? "true" : "false"
  }
  secret = ACTIONS_RESULTS_URL != "" && ACTIONS_RUNTIME_TOKEN != "" ? [
    "id=ACTIONS_RESULTS_URL,env=ACTIONS_RESULTS_URL",
    "id=ACTIONS_RUNTIME_TOKEN,env=ACTIONS_RUNTIME_TOKEN"
  ] : []
}

group "default" {
  targets = ["timekeeper", "user", "timesync", "frontend"]
}

target "timekeeper" {
  inherits = ["sccache-secrets", "docker-metadata-action-timekeeper"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-timekeeper"
  }
}

target "user" {
  inherits = ["sccache-secrets", "docker-metadata-action-user"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-user"
  }
}

target "timesync" {
  inherits = ["sccache-secrets", "docker-metadata-action-timesync"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-timesync"
  }
}

target "frontend" {
  inherits = ["docker-metadata-action-frontend"]
  context = "./bun"
  dockerfile = "Dockerfile.frontend"
}

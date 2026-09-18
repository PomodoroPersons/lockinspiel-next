target "docker-metadata-action-timekeeper" {}
target "docker-metadata-action-user" {}
target "docker-metadata-action-timesync" {}
target "docker-metadata-action-frontend" {}

variable "ACTIONS_CACHE_URL" {
  default = ""
}

variable "ACTIONS_RUNTIME_TOKEN" {
  default = ""
}

target "sccache-secrets" {
  secret = [
    "id=actions_cache_url,env=ACTIONS_CACHE_URL",
    "id=actions_runtime_token,env=ACTIONS_RUNTIME_TOKEN"
  ]
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

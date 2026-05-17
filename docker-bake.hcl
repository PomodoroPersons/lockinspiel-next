target "docker-metadata-action-auth" {}
target "docker-metadata-action-timekeeper" {}
target "docker-metadata-action-frontend" {}
target "docker-metadata-action-analyzer" {}
target "docker-metadata-action-user" {}

group "default" {
  targets = ["auth", "timekeeper", "frontend", "analyzer", "user"]
}

target "auth" {
  inherits = ["docker-metadata-action-auth"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-auth"
  }
}

target "timekeeper" {
  inherits = ["docker-metadata-action-timekeeper"]
  context = "./bun"
  args = {
    PACKAGE = "lockinspiel-timekeeper"
    SERVICE_TYPE = "timekeeper"
  }
}

target "frontend" {
  inherits = ["docker-metadata-action-frontend"]
  context = "./bun"
  dockerfile = "Dockerfile.frontend"
}

target "analyzer" {
  inherits = ["docker-metadata-action-analyzer"]
  context = "./java"
  args = {
    PACKAGE = "lockinspiel-analyzer"
    SERVICE_TYPE = "analyzer"
  }
}

target "user" {
  inherits = ["docker-metadata-action-user"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-user"
  }
}

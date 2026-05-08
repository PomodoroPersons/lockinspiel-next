target "docker-metadata-action-auth" {}
target "docker-metadata-action-timekeeper" {}
target "docker-metadata-action-analyzer" {}
target "docker-metadata-action-frontend" {}

group "default" {
  targets = ["auth", "timekeeper", "analyzer", "frontend"]
}

target "auth" {
  inherits = ["docker-metadata-action-auth"]
  context = "."
  dockerfile = "./docker/rust/Dockerfile"
  args = {
    SERVICE = "lockinspiel-auth"
  }
}

target "timekeeper" {
  inherits = ["docker-metadata-action-timekeeper"]
  context = "."
  dockerfile = "./docker/bun/Dockerfile"
  args = {
    PACKAGE = "lockinspiel-timekeeper"
    SERVICE_TYPE = "timekeeper"
  }
}

target "analyzer" {
  inherits = ["docker-metadata-action-analyzer"]
  context = "."
  dockerfile = "./docker/java/Dockerfile"
  args = {
    PACKAGE = "lockinspiel-analyzer"
    SERVICE_TYPE = "analyzer"
  }
}

target "frontend" {
  inherits = ["docker-metadata-action-frontend"]
  context = "."
  dockerfile = "./docker/bun/Dockerfile.frontend"
}

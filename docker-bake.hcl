target "docker-metadata-action-auth" {}
target "docker-metadata-action-timekeeper" {}

group "default" {
  targets = ["auth", "timekeeper"]
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

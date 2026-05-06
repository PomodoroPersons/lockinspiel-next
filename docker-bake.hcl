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
    SERVICE = "auth"
  }
}

target "timekeeper" {
  inherits = ["docker-metadata-action-timekeeper"]
  context = "./lockinspiel-timekeeper"
  contexts = {
    shared-docker = "../docker/bun"
  }
  dockerfile = "context:shared-docker/bun/Dockerfile"
  args = {
    SERVICE = "timekeeper"
  }
}

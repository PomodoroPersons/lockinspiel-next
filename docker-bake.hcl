target "docker-metadata-action" {}

group "default" {
  targets = ["auth", "timekeeper"]
}

target "auth" {
  inherits = ["docker-metadata-action"]
  context = "."
  dockerfile = "./docker/rust/Dockerfile"
  args = {
    SERVICE = "auth"
  }
}

target "timekeeper" {
  inherits = ["docker-metadata-action"]
  context = "./lockinspiel-timekeeper"
  dockerfile = "../docker/bun/Dockerfile"
  args = {
    SERVICE = "timekeeper"
  }
}

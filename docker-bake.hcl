target "docker-metadata-action-auth" {}
target "docker-metadata-action-timekeeper" {}

group "default" {
  targets = ["auth", "timekeeper"]
}

target "auth" {
  inherits = ["docker-metadata-action-auth"]
  context = "."
  dockerfile = "cwd://docker/rust/Dockerfile"
  args = {
    SERVICE = "auth"
  }
}

target "timekeeper" {
  inherits = ["docker-metadata-action-timekeeper"]
  context = "./lockinspiel-timekeeper"
  dockerfile = "cwd://docker/bun/Dockerfile"
  args = {
    SERVICE = "timekeeper"
  }
}

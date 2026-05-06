target "docker-metadata-action" {}

group "default" {
  targets = ["auth"]
}

target "auth" {
  inherits = ["docker-metadata-action"]
  context = "."
  dockerfile = "./docker/rust/Dockerfile"
  args = {
    SERVICE = "auth"
  }
  tags = ["lockinspiel/auth:latest"]
}

group "default" {
  targets = ["auth"]
}

target "auth" {
  context = "."
  dockerfile = "./docker/rust/Dockerfile"
  args = {
    SERVICE = "auth"
  }
  tags = ["lockinspiel/auth:latest"]
}

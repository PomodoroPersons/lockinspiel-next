target "docker-metadata-action-timekeeper" {}
target "docker-metadata-action-user" {}
target "docker-metadata-action-timesync" {}
target "docker-metadata-action-frontend" {}

group "default" {
  targets = ["timekeeper", "user", "timesync", "frontend"]
}

target "timekeeper" {
  inherits = ["docker-metadata-action-timekeeper"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-timekeeper"
  }
}

target "user" {
  inherits = ["docker-metadata-action-user"]
  context = "./rust"
  args = {
    SERVICE = "lockinspiel-user"
  }
}

target "timesync" {
  inherits = ["docker-metadata-action-timesync"]
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

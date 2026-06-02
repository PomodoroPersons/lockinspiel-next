#!/bin/sh
set -eu

SERVICE_ID="$(dig -x "$(hostname -i)" +short || true)"
export SERVICE_ID

exec "$@"

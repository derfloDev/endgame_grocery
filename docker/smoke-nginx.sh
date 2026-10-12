#!/usr/bin/env bash
# Exercise only nginx and built assets: bypass migrations, supervisor and the backend.
set -Eeuo pipefail

fail() { echo "nginx smoke: $*" >&2; exit 1; }
[[ $# == 1 && -n $1 ]] || fail "usage: bash docker/smoke-nginx.sh IMAGE_TAG"
for tool in docker curl mktemp awk sed grep gzip cmp sleep rm wc; do
  command -v "$tool" >/dev/null 2>&1 || fail "required host tool is unavailable: $tool"
done
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable"
image=$1
container=''
scratch=$(mktemp -d)
# Only remove the container created by this invocation; print its logs on failure.
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n $container ]]; then
    if (( status != 0 )); then docker logs "$container" >&2 || true; fi
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$scratch"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --rm --entrypoint nginx "$image" -t
container=$(docker run -d --entrypoint nginx -p 127.0.0.1::80 "$image" -g 'daemon off;')
port=$(docker port "$container" 80/tcp | awk -F: '$1 == "127.0.0.1" {print $NF}')
[[ $port =~ ^[0-9]+$ ]] || fail "could not discover the localhost port"
base="http://127.0.0.1:$port"
running() {
  [[ $(docker inspect --format '{{.State.Running}}' "$container") == true ]] || fail "nginx container exited unexpectedly"
}
ready=false
for (( attempt=0; attempt<30; attempt++ )); do
  running
  if curl --silent --fail --max-time 2 "$base/index.html" -o "$scratch/index"; then
    ready=true
    break
  fi
  sleep 1
done
[[ $ready == true ]] || fail "HTTP readiness timed out"

header_values() {
  awk -v name="$2" 'tolower($0) ~ "^" tolower(name) ":" {sub(/^[^:]*:[ \t]*/, ""); sub(/\r$/, ""); print}' "$1"
}
request() {
  local path=$1 cache=$2 name=$3 encoding=${4:-identity}
  running
  curl --silent --show-error --fail --max-time 15 -H "Accept-Encoding: $encoding" \
    -D "$scratch/$name.headers" -o "$scratch/$name.body" "$base$path"
  grep -Eq '^HTTP/[0-9.]+ 200[[:space:]]' "$scratch/$name.headers" || fail "$path did not return HTTP 200"
  [[ $(header_values "$scratch/$name.headers" Cache-Control) == "$cache" ]] || fail "$path has incorrect or multiple Cache-Control headers"
  for header in Content-Security-Policy X-Content-Type-Options Referrer-Policy Permissions-Policy; do
    [[ -n $(header_values "$scratch/$name.headers" "$header") ]] || fail "$path lacks $header"
  done
}
request /index.html no-cache index
request /service-worker.js no-cache worker
request /lists/smoke-test no-cache spa
cmp "$scratch/index.body" "$scratch/spa.body" || fail "SPA route did not return the app shell"
# Discover real hashed JS/CSS assets from the built shell, never a fixed Vite chunk name.
mapfile -t assets < <(grep -oE '/assets/[^"<> ]+-[A-Za-z0-9_-]+\.(js|css)' "$scratch/index.body")
(( ${#assets[@]} > 0 )) || fail "no hashed JS/CSS asset found in the app shell"
asset=''
for candidate in "${assets[@]}"; do
  request "$candidate" 'public, max-age=31536000, immutable' identity
  # Pick a real text asset large enough to exercise compression.
  if (( $(wc -c < "$scratch/identity.body") >= 1024 )); then asset=$candidate; break; fi
done
[[ -n $asset ]] || fail "no sufficiently large text asset found"
request "$asset" 'public, max-age=31536000, immutable' compressed gzip
[[ $(header_values "$scratch/compressed.headers" Content-Encoding) == gzip ]] || fail "asset was not gzip encoded"
header_values "$scratch/compressed.headers" Vary | grep -Eiq '(^|[,[:space:]])Accept-Encoding([,[:space:]]|$)' || fail "Vary lacks Accept-Encoding"
gzip -dc "$scratch/compressed.body" > "$scratch/decoded.body"
cmp "$scratch/identity.body" "$scratch/decoded.body" || fail "gzip changed the asset bytes"
running
echo "nginx smoke: configuration, HTTP, cache/security headers and gzip passed"

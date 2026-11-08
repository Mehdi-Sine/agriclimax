#!/usr/bin/env bash
# Install only these pinned CI tools. Installation never substitutes for scanning.
set -euo pipefail

if [[ $# != 2 ]]; then
  echo 'Usage: install-go-tool.sh {actionlint|gitleaks} destination-directory' >&2
  exit 2
fi
tool=$1
case "$tool" in
  actionlint)
    version=v1.7.7
    module=github.com/rhysd/actionlint
    package=$module/cmd/actionlint
    url=https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz
    checksum=023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757
    ;;
  gitleaks)
    version=v8.24.2
    # The official repository moved; its versioned Go module retains this path.
    module=github.com/zricethezav/gitleaks/v8
    package=$module
    url=https://github.com/gitleaks/gitleaks/releases/download/v8.24.2/gitleaks_8.24.2_linux_x64.tar.gz
    checksum=fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e
    ;;
  *) echo "Unsupported CI tool: $tool" >&2; exit 2 ;;
esac

destination=$(realpath -m -- "$2")
mkdir -p -- "$destination"
# A failed installation must not leave a previously installed scanner usable.
rm -f -- "$destination/$tool"
staging=$(mktemp -d "$destination/install.XXXXXXXX")
# Go deliberately makes extracted module files read-only. Only this private
# staging tree is made writable again, after verification/build, for cleanup.
trap 'chmod -R u+w -- "$staging"; rm -rf -- "$staging"' EXIT
mkdir -p "$staging/bin"

# curl retries HTTP 408/429/500/502/503/504, timeouts and refused
# connections, but does not retry permanent HTTP errors such as 404.
# Four attempts at most; the outer timeout also bounds Retry-After delays.
if timeout 150s curl --fail --location --silent --show-error \
  --proto '=https' --proto-redir '=https' \
  --connect-timeout 10 --max-time 30 \
  --retry 3 --retry-delay 3 --retry-max-time 120 --retry-connrefused \
  --output "$staging/release.tar.gz" "$url"; then
  # Integrity errors are terminal, never hidden by switching install methods.
  if ! printf '%s  %s\n' "$checksum" "$staging/release.tar.gz" | sha256sum --check; then
    echo "ERROR: $tool $version release checksum mismatch; refusing installation." >&2
    exit 1
  fi
  tar -xzf "$staging/release.tar.gz" -C "$staging/bin" "$tool"
  echo "Verified official release: $tool $version"
else
  echo "Release unavailable after bounded retries; building $package@$version with sum.golang.org." >&2
  command -v go >/dev/null || { echo 'ERROR: Go is required for the verified fallback.' >&2; exit 1; }
  # Ignore workstation configuration, private-module exemptions and cached
  # modules. The public checksum database authenticates the entire module graph.
  export GOENV=off GOWORK=off GOFLAGS='' GOTOOLCHAIN=local GO111MODULE=on
  export GOPROXY=https://proxy.golang.org GOSUMDB=sum.golang.org
  export GOPRIVATE='' GONOPROXY='' GONOSUMDB='' GOINSECURE=''
  export GOPATH="$staging/gopath" GOMODCACHE="$staging/modules" GOCACHE="$staging/build-cache"
  export GOBIN="$staging/bin" GOOS=linux GOARCH=amd64 CGO_ENABLED=0
  built=false
  for attempt in 1 2; do
    if timeout 180s go install -trimpath "$package@$version"; then
      built=true
      break
    fi
    echo "Go installation attempt $attempt/2 failed for $tool $version." >&2
    if [[ $attempt == 1 ]]; then sleep 3; fi
  done
  if [[ $built != true ]]; then
    echo "ERROR: neither official release nor checksum-verified Go installation is available for $tool $version." >&2
    exit 1
  fi
  # Gitleaks source builds may print 'dev'; Go build metadata is authoritative.
  # Reject a missing binary or a different/unversioned main module.
  go version -m "$staging/bin/$tool" | tee "$staging/build-info.txt"
  if ! awk -v module="$module" -v version="$version" '
    $1 == "mod" && $2 == module && $3 == version && $4 ~ /^h1:/ { found = 1 }
    END { exit !found }
  ' "$staging/build-info.txt"; then
    echo "ERROR: missing or unexpected verified module metadata for $tool $version." >&2
    exit 1
  fi
  echo "Verified Go module build: $tool $version"
fi

test -x "$staging/bin/$tool"
install -m 0755 "$staging/bin/$tool" "$destination/$tool"

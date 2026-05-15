#!/usr/bin/env bash
# spike-ssotoken-ttl.sh
#
# POSIX/bash flavor of spike-ssotoken-ttl.ps1. Measures how long an
# oasis.ssu.ac.kr ssotoken cookie stays valid by polling /pyxis-api/api/smuf/
# reading-rooms until it returns the `needLogin` auth error.
#
# Usage:
#   export OASIS_SSOTOKEN="<paste captured ssotoken value here>"
#   ./scripts/spike-ssotoken-ttl.sh
#
# Optional:
#   export OASIS_TTL_INTERVAL_SEC=300       # default 300 (5 min)
#   export OASIS_TTL_LOG=scripts/ssotoken-ttl.log
#
# Output matches *.log so it is gitignored.

set -u

: "${OASIS_SSOTOKEN:?Set OASIS_SSOTOKEN to the captured ssotoken value before running}"

interval="${OASIS_TTL_INTERVAL_SEC:-300}"
log="${OASIS_TTL_LOG:-scripts/ssotoken-ttl.log}"
url="https://oasis.ssu.ac.kr/pyxis-api/api/smuf/reading-rooms"

fingerprint=$(printf '%s' "$OASIS_SSOTOKEN" | sha256sum | cut -c1-8)
started=$(date -Iseconds)
started_epoch=$(date +%s)

echo "started=$started fingerprint=$fingerprint interval=${interval}s url=$url" | tee -a "$log"

poll=0
while :; do
    poll=$((poll + 1))
    now=$(date -Iseconds)
    body=$(curl -fsS -H "Cookie: ssotoken=$OASIS_SSOTOKEN" "$url" 2>/dev/null || echo "__curl_error__")

    if [ "$body" = "__curl_error__" ]; then
        echo "$now poll=$poll status=error" | tee -a "$log"
    elif printf '%s' "$body" | grep -q 'needLogin'; then
        now_epoch=$(date +%s)
        elapsed=$((now_epoch - started_epoch))
        hours=$(awk "BEGIN { printf \"%.2f\", $elapsed/3600 }")
        echo "$now poll=$poll status=expired elapsed=${elapsed}s" | tee -a "$log"
        echo ""
        echo "===== TTL measurement complete ====="
        echo "Token died after $elapsed seconds (${hours} hours)."
        echo "Log: $log"
        break
    else
        bodylen=${#body}
        echo "$now poll=$poll status=ok bodylen=$bodylen" | tee -a "$log"
    fi

    sleep "$interval"
done

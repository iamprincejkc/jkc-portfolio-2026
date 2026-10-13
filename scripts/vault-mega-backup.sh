#!/usr/bin/env bash
#
# Copy every vault video from R2 that MEGA does not have yet.
#
# Run by .github/workflows/vault-mega-backup.yml. A second copy on a second
# provider, made without the phone uploading anything twice.
#
# Deliberately a copy, not a mirror: deleting a video in the gallery admin does
# NOT delete its MEGA copy. A backup that follows deletions protects against
# nothing but a dead disk.
#
# The repository is public, and so are its Actions logs. Nothing here prints a
# key, a filename or a title - only counts.

set -euo pipefail

: "${R2_ACCOUNT_ID:?}" "${R2_BUCKET:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"
: "${MEGA_EMAIL:?}" "${MEGA_PASSWORD:?}"

MEGA_ROOT="${MEGA_ROOT:-/Vault}"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

login_args=("$MEGA_EMAIL" "$MEGA_PASSWORD")
if [[ -n "${MEGA_TOTP_SECRET:-}" ]]; then
  login_args+=("--auth-code=$(oathtool --totp -b "$MEGA_TOTP_SECRET")")
fi

# One login per run. MEGA locks accounts out after bursts of logins, so this
# job never logs in more than once, and logs out when done.
mega-login "${login_args[@]}" >/dev/null
trap 'mega-logout >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

aws s3api list-objects-v2 \
  --endpoint-url "$ENDPOINT" \
  --bucket "$R2_BUCKET" \
  --prefix videos/ \
  --query 'Contents[].Key' \
  --output text >"$WORK/keys"

copied=0
present=0
failed=0

# `list-objects-v2 --output text` separates keys with tabs, and prints "None"
# for an empty bucket. Vault keys never contain whitespace.
for key in $(tr '\t' '\n' <"$WORK/keys"); do
  [[ "$key" == "None" ]] && continue

  remote="$MEGA_ROOT/$key"
  if mega-ls "$remote" >/dev/null 2>&1; then
    present=$((present + 1))
    continue
  fi

  local_file="$WORK/$(basename "$key")"
  if aws s3 cp "s3://$R2_BUCKET/$key" "$local_file" --endpoint-url "$ENDPOINT" --only-show-errors >/dev/null \
    && mega-put -c "$local_file" "$(dirname "$remote")/" >/dev/null; then
    copied=$((copied + 1))
  else
    failed=$((failed + 1))
  fi
  # One file on disk at a time: the runner's disk is far smaller than the vault.
  rm -f "$local_file"
done

echo "Vault backup: $copied copied, $present already on MEGA, $failed failed."
{
  echo "### Vault backup to MEGA"
  echo ""
  echo "| Copied | Already there | Failed |"
  echo "|---|---|---|"
  echo "| $copied | $present | $failed |"
} >>"${GITHUB_STEP_SUMMARY:-/dev/null}"

mega-df -h 2>/dev/null | head -n 3 || true

[[ "$failed" -eq 0 ]]

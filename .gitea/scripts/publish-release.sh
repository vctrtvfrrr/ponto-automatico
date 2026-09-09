#!/usr/bin/env bash
set -euo pipefail

filename='ponto-automatico-chrome.zip'
test -r "$filename"

releases_url="${GITEA_API_URL}/repos/${GITEA_REPOSITORY}/releases"
encoded_tag=$(jq -rn --arg tag "$RELEASE_TAG" '$tag | @uri')
response_file=$(mktemp)
trap 'rm -f "$response_file"' EXIT

status=$(curl --silent --show-error \
  --header "Authorization: token $GITEA_TOKEN" \
  --output "$response_file" --write-out '%{http_code}' \
  "$releases_url/tags/$encoded_tag")

case "$status" in
  200) ;;
  404)
    curl --fail-with-body --silent --show-error \
      --header "Authorization: token $GITEA_TOKEN" \
      --header 'Content-Type: application/json' \
      --data "$(jq -cn --arg tag "$RELEASE_TAG" '{tag_name: $tag, name: $tag}')" \
      --output "$response_file" \
      "$releases_url"
    ;;
  *)
    printf 'Could not get release: HTTP %s\n' "$status" >&2
    exit 1
    ;;
esac

release_id=$(jq -er '.id' "$response_file")
release_url=$(jq -er '.html_url' "$response_file")

curl --fail-with-body --silent --show-error \
  --header "Authorization: token $GITEA_TOKEN" \
  --form "attachment=@${filename};type=application/zip" \
  --output /dev/null \
  "$releases_url/$release_id/assets"

printf 'Published %s to %s\n' "$filename" "$release_url"

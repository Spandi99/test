#!/usr/bin/env bash
# Utility functions to simplify managing FluidCalendar versions on a Raspberry Pi.
#
# Source this file on the Pi (e.g. `source scripts/pi-version-manager.sh`) to
# gain helper functions for switching between tagged releases, rebuilding the
# container, and cleaning up Compose state. The functions assume the repository
# has been cloned onto the device and Docker Compose is available as `docker compose`.

set -euo pipefail

# Allow overriding defaults through environment variables before sourcing.
FC_PI_REPO_DIR=${FC_PI_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
FC_PI_COMPOSE_FILE=${FC_PI_COMPOSE_FILE:-docker-compose.pi.yml}
FC_PI_ENV_FILE=${FC_PI_ENV_FILE:-.env.pi}
FC_PI_DOCKER_COMPOSE=${FC_PI_DOCKER_COMPOSE:-docker compose}

_fc_pi_repo() {
  git -C "$FC_PI_REPO_DIR" "$@"
}

_fc_pi_check_clean() {
  if [[ -n "$(_fc_pi_repo status --porcelain)" ]]; then
    echo "Working tree has uncommitted changes. Commit or stash them before switching versions." >&2
    return 1
  fi
}

_fc_pi_ensure_env() {
  if [[ ! -f "$FC_PI_REPO_DIR/$FC_PI_ENV_FILE" ]]; then
    echo "Environment file '$FC_PI_ENV_FILE' not found in $FC_PI_REPO_DIR. Create it (e.g. cp docs/examples/pi.env.example $FC_PI_ENV_FILE)." >&2
    return 1
  fi
}

_fc_pi_compose() {
  $FC_PI_DOCKER_COMPOSE -f "$FC_PI_REPO_DIR/$FC_PI_COMPOSE_FILE" --env-file "$FC_PI_REPO_DIR/$FC_PI_ENV_FILE" "$@"
}

_fc_pi_tag_list() {
  _fc_pi_repo tag --sort=version:refname
}

_fc_pi_current_ref() {
  if _fc_pi_repo describe --tags --exact-match >/dev/null 2>&1; then
    _fc_pi_repo describe --tags --exact-match
  else
    _fc_pi_repo rev-parse --abbrev-ref HEAD
  fi
}

_fc_pi_tags_array() {
  mapfile -t FC_PI_TAGS < <(_fc_pi_tag_list)
}

fc_pi_list_versions() {
  echo "Available tags (ascending):"
  _fc_pi_tag_list
}

fc_pi_current_version() {
  _fc_pi_current_ref
}

fc_pi_use_version() {
  if [[ $# -ne 1 ]]; then
    echo "Usage: fc_pi_use_version <git-ref>" >&2
    return 1
  fi

  local ref=$1

  _fc_pi_check_clean || return 1
  _fc_pi_ensure_env || return 1

  echo "Fetching updates..."
  _fc_pi_repo fetch --tags

  echo "Checking out $ref ..."
  _fc_pi_repo checkout "$ref"

  echo "Stopping existing containers (removing orphans)..."
  _fc_pi_compose down --remove-orphans

  echo "Building and starting $ref ..."
  _fc_pi_compose up -d --build

  echo "Switched to $(fc_pi_current_version)"
}

fc_pi_next_version() {
  _fc_pi_check_clean || return 1
  _fc_pi_tags_array

  local current=$(_fc_pi_current_ref)
  local idx=-1

  for i in "${!FC_PI_TAGS[@]}"; do
    if [[ "${FC_PI_TAGS[$i]}" == "$current" ]]; then
      idx=$i
      break
    fi
  done

  if (( idx < 0 )); then
    echo "Current ref '$current' is not a tagged release. Use fc_pi_use_version <tag> first." >&2
    return 1
  fi

  if (( idx + 1 >= ${#FC_PI_TAGS[@]} )); then
    echo "Already at the newest tag (or no newer tag available)." >&2
    return 1
  fi

  fc_pi_use_version "${FC_PI_TAGS[$((idx + 1))]}"
}

fc_pi_previous_version() {
  _fc_pi_check_clean || return 1
  _fc_pi_tags_array

  local current=$(_fc_pi_current_ref)
  local idx=-1

  for i in "${!FC_PI_TAGS[@]}"; do
    if [[ "${FC_PI_TAGS[$i]}" == "$current" ]]; then
      idx=$i
      break
    fi
  done

  if (( idx < 0 )); then
    echo "Current ref '$current' is not a tagged release. Use fc_pi_use_version <tag> first." >&2
    return 1
  fi

  if (( idx == 0 )); then
    echo "Already at the earliest tag (or no previous tag available)." >&2
    return 1
  fi

  fc_pi_use_version "${FC_PI_TAGS[$((idx - 1))]}"
}

fc_pi_rebuild_current() {
  _fc_pi_check_clean || return 1
  _fc_pi_ensure_env || return 1

  local current=$(_fc_pi_current_ref)
  echo "Rebuilding current ref $current ..."
  _fc_pi_compose down --remove-orphans
  _fc_pi_compose up -d --build
}

fc_pi_status() {
  echo "Repository: $FC_PI_REPO_DIR"
  echo "Compose file: $FC_PI_COMPOSE_FILE"
  echo "Env file: $FC_PI_ENV_FILE"
  echo "Current ref: $(_fc_pi_current_ref)"
  echo "Containers:"
  _fc_pi_compose ps
}


#!/usr/bin/env bash
set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-fluid}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-fluid}"
POSTGRES_DB="${POSTGRES_DB:-fluid_calendar}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

RADICALE_USERNAME="${RADICALE_USERNAME:-fluid}"
RADICALE_PASSWORD="${RADICALE_PASSWORD:-fluid}"
RADICALE_CONFIG="${RADICALE_CONFIG:-/etc/radicale/config}"
RADICALE_USERS_FILE="${RADICALE_USERS_FILE:-/etc/radicale/users}"
RADICALE_STORAGE="${RADICALE_STORAGE:-/var/lib/radicale/collections}"

APP_STATE_DIR="${APP_STATE_DIR:-/var/lib/fluidcalendar}"
NEXTAUTH_SECRET_FILE="${NEXTAUTH_SECRET_FILE:-${APP_STATE_DIR}/nextauth_secret}"

mkdir -p "${APP_STATE_DIR}"

if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  if [ -s "${NEXTAUTH_SECRET_FILE}" ]; then
    export NEXTAUTH_SECRET="$(cat "${NEXTAUTH_SECRET_FILE}")"
    echo "Loaded persisted NEXTAUTH_SECRET from ${NEXTAUTH_SECRET_FILE}."
  else
    export NEXTAUTH_SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
    printf '%s' "${NEXTAUTH_SECRET}" > "${NEXTAUTH_SECRET_FILE}"
    chmod 600 "${NEXTAUTH_SECRET_FILE}"
    echo "Generated and persisted NEXTAUTH_SECRET at ${NEXTAUTH_SECRET_FILE}."
  fi
else
  printf '%s' "${NEXTAUTH_SECRET}" > "${NEXTAUTH_SECRET_FILE}"
  chmod 600 "${NEXTAUTH_SECRET_FILE}"
  echo "Persisted provided NEXTAUTH_SECRET to ${NEXTAUTH_SECRET_FILE}."
fi

if [ -z "${NEXTAUTH_URL:-}" ]; then
  export NEXTAUTH_URL="http://192.168.1.132:3000"
  echo "NEXTAUTH_URL not provided. Defaulting to ${NEXTAUTH_URL}."
fi

if [ -z "${NEXT_PUBLIC_APP_URL:-}" ]; then
  export NEXT_PUBLIC_APP_URL="${NEXTAUTH_URL}"
  echo "NEXT_PUBLIC_APP_URL not provided. Defaulting to NEXTAUTH_URL (${NEXTAUTH_URL})."
fi

PG_VERSION="$(pg_config --version | awk '{print $2}' | cut -d. -f1)"
PG_CLUSTER="main"

# Ensure PostgreSQL cluster exists
if ! pg_lsclusters | awk '{print $1 " " $2}' | grep -q "${PG_VERSION} ${PG_CLUSTER}"; then
  echo "Creating PostgreSQL cluster ${PG_VERSION}/${PG_CLUSTER}..."
  pg_createcluster "${PG_VERSION}" "${PG_CLUSTER}"
fi

# Configure PostgreSQL networking before starting the cluster
CURRENT_PORT="$(pg_conftool "${PG_VERSION}" "${PG_CLUSTER}" show port | awk '{print $2}')"
if [ "${CURRENT_PORT}" != "${POSTGRES_PORT}" ]; then
  echo "Configuring PostgreSQL to listen on port ${POSTGRES_PORT}..."
  pg_conftool "${PG_VERSION}" "${PG_CLUSTER}" set port "${POSTGRES_PORT}"
fi

CURRENT_LISTEN="$(pg_conftool "${PG_VERSION}" "${PG_CLUSTER}" show listen_addresses | awk '{print $2}')"
if [ "${CURRENT_LISTEN}" != "'0.0.0.0'" ]; then
  echo "Configuring PostgreSQL listen_addresses to 0.0.0.0..."
  pg_conftool "${PG_VERSION}" "${PG_CLUSTER}" set listen_addresses "'0.0.0.0'"
fi

PG_HBA_FILE="/etc/postgresql/${PG_VERSION}/${PG_CLUSTER}/pg_hba.conf"
if ! grep -qE "^host\\s+all\\s+all\\s+0\\.0\\.0\\.0/0\\s+scram-sha-256" "${PG_HBA_FILE}"; then
  echo "Updating pg_hba.conf to allow password access from any host..."
  printf '\nhost all all 0.0.0.0/0 scram-sha-256\n' >> "${PG_HBA_FILE}"
fi

# Start PostgreSQL cluster
if ! pg_lsclusters | awk '$1 == v && $2 == c {print $4}' v="${PG_VERSION}" c="${PG_CLUSTER}" | grep -q "online"; then
  echo "Starting PostgreSQL..."
  pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" start
fi

cleanup() {
  echo "Stopping services..."
  if ps -p ${RADICALE_PID:-0} >/dev/null 2>&1; then
    kill "${RADICALE_PID}" 2>/dev/null || true
  fi
  pg_ctlcluster "${PG_VERSION}" "${PG_CLUSTER}" stop || true
}
trap cleanup EXIT TERM INT

# Configure PostgreSQL roles and database
export PGPASSWORD="${POSTGRES_PASSWORD}"
if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'\"" | grep -q 1; then
  echo "Creating PostgreSQL role ${POSTGRES_USER}..."
  su - postgres -c "psql -c \"CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}'\""
else
  su - postgres -c "psql -c \"ALTER ROLE ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}'\"" >/dev/null
fi

if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\"" | grep -q 1; then
  echo "Creating database ${POSTGRES_DB}..."
  su - postgres -c "createdb ${POSTGRES_DB}"
fi

su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER}\"" >/dev/null

# Prepare Radicale storage and users
mkdir -p "${RADICALE_STORAGE}"
mkdir -p "$(dirname "${RADICALE_USERS_FILE}")"

if [ ! -f "${RADICALE_USERS_FILE}" ]; then
  echo "Configuring Radicale credentials for user ${RADICALE_USERNAME}..."
  htpasswd -Bcb "${RADICALE_USERS_FILE}" "${RADICALE_USERNAME}" "${RADICALE_PASSWORD}"
else
  echo "Updating Radicale credentials for user ${RADICALE_USERNAME}..."
  htpasswd -Bb "${RADICALE_USERS_FILE}" "${RADICALE_USERNAME}" "${RADICALE_PASSWORD}"
fi

# Start Radicale in background
radicale --config "${RADICALE_CONFIG}" &
RADICALE_PID=$!

# Wait for PostgreSQL to accept connections
until pg_isready -h 127.0.0.1 -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  echo "Waiting for PostgreSQL to become ready..."
  sleep 1
done

echo "PostgreSQL is ready. Running Prisma migrations..."
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public}"

npx --yes prisma generate
npx --yes prisma migrate deploy

echo "Starting FluidCalendar..."
exec "$@"

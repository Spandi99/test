# Raspberry Pi Deployment with Built-in CalDAV (Radicale)

This guide explains how to build and run FluidCalendar on a Raspberry Pi using a
single Docker container that bundles the web application, PostgreSQL, and a
Radicale CalDAV server.

## Prerequisites

- Raspberry Pi 4 (or newer) running a 64-bit OS (Debian/Raspberry Pi OS bookworm
  recommended)
- Docker and Docker Compose installed
- At least 4 GB of RAM and 10 GB of free disk space

## Download the code onto your Raspberry Pi

SSH into your Pi and clone the repository (replace the URL with your fork if
needed):

```bash
git clone https://github.com/fluidcalendar/fluid-calendar.git
cd fluid-calendar
```

If you prefer downloading a release archive instead of using Git, grab the
latest tarball from GitHub and extract it on the device:

```bash
curl -L -o fluid-calendar.tar.gz \
  https://github.com/fluidcalendar/fluid-calendar/archive/refs/heads/main.tar.gz
tar -xf fluid-calendar.tar.gz
cd fluid-calendar-main
# optional: mv fluid-calendar-main fluid-calendar && cd fluid-calendar
```

## Configure environment variables

The container reads its defaults from environment variables. Create a file that
stores the credentials you want to use (you can keep the defaults for testing):

```bash
cp docs/examples/pi.env.example .env.pi
nano .env.pi
```

Update the values in `.env.pi` as desired, then save the file. Be sure to set:

- `NEXTAUTH_URL` – the public URL (including protocol and port) where you will
  access FluidCalendar. For the dedicated Pi at `192.168.1.132`, use
  `http://192.168.1.132:3000`.
- `NEXT_PUBLIC_APP_URL` – usually the same as `NEXTAUTH_URL`
- `NEXTAUTH_SECRET` – a long random string (generate with
  `openssl rand -base64 32` or `head -c 32 /dev/urandom | base64`)

If you leave `NEXTAUTH_SECRET` empty, the container will generate one on first
boot and store it inside the `fluidcalendar_state` volume so sessions persist
across restarts.

## Build the multi-service image

From the project root, build the Docker image that bundles FluidCalendar,
PostgreSQL, and Radicale:

```bash
docker build -f docker/pi/Dockerfile -t fluid-calendar-pi .
```

The Dockerfile targets Debian bookworm and works on both AMD64 and ARM64, so it
will compile correctly on the Raspberry Pi.

Alternatively, use the provided Compose file to build and run in a single step
with persistent volumes already configured:

```bash
docker compose \
  -f docker-compose.pi.yml \
  --env-file .env.pi \
  up -d --build
```

> **Heads up:** If you previously ran an older Compose bundle that exposed a
> separate `radicale` service, clean up the orphaned container first so ports
> `5232` and `5432` are free:
>
> ```bash
> docker compose -f docker-compose.pi.yml down --remove-orphans
> ```

Docker Compose automatically provisions named volumes for PostgreSQL,
Radicale, and FluidCalendar's app state (`fluidcalendar_state`) so your
database, calendars, and NextAuth secret survive rebuilds.

## Run the container

Create a directory to persist the app secret, database, and CalDAV data:

```bash
mkdir -p \
  ~/fluidcalendar-data/app \
  ~/fluidcalendar-data/postgres \
  ~/fluidcalendar-data/radicale
```

Start the container and mount the data directories:

```bash
docker run -d \
  --name fluidcalendar \
  --env-file .env.pi \
  -p 3000:3000 \
  -p 5232:5232 \
  -v ~/fluidcalendar-data/postgres:/var/lib/postgresql \
  -v ~/fluidcalendar-data/radicale:/var/lib/radicale \
  -v ~/fluidcalendar-data/app:/var/lib/fluidcalendar \
  fluid-calendar-pi
```

> **Tip:** Set `POSTGRES_PASSWORD`, `RADICALE_USERNAME`, and `RADICALE_PASSWORD`
> to secure values before deploying in production.

The container exposes three services:

- `3000/tcp` – FluidCalendar web UI
- `5232/tcp` – Radicale CalDAV endpoint
- `5432/tcp` – PostgreSQL server

## Initial credentials and environment variables

The container automatically provisions the PostgreSQL database and Radicale
user on first start. The following environment variables control the defaults:

| Variable | Description | Default |
| --- | --- | --- |
| `POSTGRES_USER` | PostgreSQL role created for the app | `fluid` |
| `POSTGRES_PASSWORD` | Password for the PostgreSQL role | `fluid` |
| `POSTGRES_DB` | PostgreSQL database name | `fluid_calendar` |
| `POSTGRES_PORT` | Internal PostgreSQL port | `5432` |
| `RADICALE_USERNAME` | Radicale Basic Auth username | `fluid` |
| `RADICALE_PASSWORD` | Radicale Basic Auth password | `fluid` |
| `RADICALE_BASE_URL` | Internal CalDAV base URL used by the app | `http://localhost:5232` |
| `DATABASE_URL` | Prisma connection string (auto-generated if omitted) | `postgresql://fluid:fluid@127.0.0.1:5432/fluid_calendar?schema=public` |
| `NEXTAUTH_URL` | Public URL for OAuth callbacks and NextAuth | `http://192.168.1.132:3000` |
| `NEXT_PUBLIC_APP_URL` | Public URL exposed to the browser | `http://192.168.1.132:3000` |
| `NEXTAUTH_SECRET` | Secret for signing NextAuth tokens | generated & persisted automatically |

## Connect FluidCalendar to the bundled CalDAV server

Use the following values inside the FluidCalendar UI when adding a CalDAV
account:

- **Server URL:** `http://radicale:5232` when using Docker Compose with the same
  container name, `http://localhost:5232` from the Pi itself, or
  `http://192.168.1.132:5232` from another device on your network
- **Username/Password:** values from `RADICALE_USERNAME` and `RADICALE_PASSWORD`

The Radicale instance stores calendars under `/var/lib/radicale/collections`.
Mount this directory to persist calendar data between container restarts.

## Stopping the container

```bash
docker compose -f docker-compose.pi.yml down
```

If you used `docker run`, stop and remove the single container instead:

```bash
docker stop fluidcalendar && docker rm fluidcalendar
```

Stopping the container gracefully shuts down the Node.js server, Radicale, and
PostgreSQL.

## Update to a newer version later on

When new commits land upstream, pull the updates and rebuild:

```bash
cd /path/to/fluid-calendar
git pull
docker compose -f docker-compose.pi.yml --env-file .env.pi up -d --build
```

Docker Compose will recreate the container while keeping the PostgreSQL and
Radicale volumes intact.

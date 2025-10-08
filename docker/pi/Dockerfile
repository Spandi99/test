# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20
ARG DEBIAN_RELEASE=bookworm

FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-${DEBIAN_RELEASE} AS builder
WORKDIR /app

ENV DATABASE_URL=postgresql://fluid:fluid@localhost:5432/fluid_calendar?schema=public

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-${DEBIAN_RELEASE} AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv \
      postgresql \
      postgresql-client \
      postgresql-contrib \
      libpq-dev \
      build-essential \
      apache2-utils \
      netcat-openbsd \
      jq \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/radicale \
    && /opt/radicale/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/radicale/bin/pip install --no-cache-dir radicale \
    && ln -s /opt/radicale/bin/radicale /usr/local/bin/radicale

COPY docker/pi/radicale.config /etc/radicale/config
RUN mkdir -p /var/lib/radicale/collections
RUN mkdir -p /var/lib/fluidcalendar

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts
RUN cd node_modules/bcrypt && npm rebuild bcrypt --build-from-source

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY docker/pi/entrypoint.sh /usr/local/bin/pidev-entrypoint.sh
RUN chmod +x /usr/local/bin/pidev-entrypoint.sh

EXPOSE 3000 5232 5432

ENV APP_STATE_DIR=/var/lib/fluidcalendar
ENV POSTGRES_USER=fluid
ENV POSTGRES_PASSWORD=fluid
ENV POSTGRES_DB=fluid_calendar
ENV POSTGRES_PORT=5432
ENV RADICALE_USERNAME=fluid
ENV RADICALE_PASSWORD=fluid
ENV RADICALE_BASE_URL=http://localhost:5232
ENV DATABASE_URL=postgresql://fluid:fluid@127.0.0.1:5432/fluid_calendar?schema=public

ENTRYPOINT ["/usr/local/bin/pidev-entrypoint.sh"]
CMD ["node", "server.js"]

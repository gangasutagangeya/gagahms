# This file is moved to the root directory before building the image

# base node image
FROM node:20-bookworm-slim as base

# set for base and all layer that inherit from it
ENV NODE_ENV production

# Install openssl for Prisma
RUN apt-get update && apt-get install -y fuse3 openssl sqlite3 ca-certificates

# Install all node_modules, including dev dependencies
FROM base as deps

WORKDIR /myapp

ADD package.json package-lock.json .npmrc ./
RUN npm ci --include=dev

# Setup production node_modules
FROM base as production-deps

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules
ADD package.json package-lock.json .npmrc ./
RUN npm prune --omit=dev

# Build the app
FROM base as build

ARG COMMIT_SHA
ENV COMMIT_SHA=$COMMIT_SHA

# Use the following environment variables to configure Sentry
# ENV SENTRY_ORG=
# ENV SENTRY_PROJECT=


WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules

ADD prisma .
RUN npx prisma generate

ADD . .

# Mount the secret and set it as an environment variable and run the build
# RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
  # export SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) && \
  # npm run build

# Finally, build the production image with minimal footprint
FROM base

# ENV FLY="true"
# ENV DATABASE_FILENAME="sqlite.db"
# ENV DATABASE_URL="file:$DATABASE_PATH"
# ENV INTERNAL_PORT="8080"
ENV PORT="8080"
ENV NODE_ENV="production"
# For WAL support: https://github.com/prisma/prisma-engines/issues/4675#issuecomment-1914383246
ENV PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1"
ENV DATABASE_URL = "postgres://postgres:postgres@database-1.cp8u6kwa2o08.ap-south-2.rds.amazonaws.com:5432/postgres"
ENV HONEYPOT_SECRET="super-duper-s3cret"
# ENV DATABASE_PATH: ""
ENV SESSION_SECRET: "fe7305585d7f16fc18e34caa9743ce74"
# ENV CACHE_DATABASE_PATH: ""

# add shortcut for connecting to database CLI
# RUN echo "#!/bin/sh\nset -x\nsqlite3 \$DATABASE_URL" > /usr/local/bin/database-cli && chmod +x /usr/local/bin/database-cli

WORKDIR /myapp

# Generate random value and save it to .env file which will be loaded by dotenv
RUN INTERNAL_COMMAND_TOKEN=$(openssl rand -hex 32) && \
  echo "INTERNAL_COMMAND_TOKEN=$INTERNAL_COMMAND_TOKEN" > .env

COPY --from=production-deps /myapp/node_modules /myapp/node_modules
COPY --from=build /myapp/node_modules/.prisma /myapp/node_modules/.prisma

COPY --from=build /myapp/server-build /myapp/server-build
COPY --from=build /myapp/build /myapp/build
COPY --from=build /myapp/package.json /myapp/package.json
COPY --from=build /myapp/prisma /myapp/prisma
COPY --from=build /myapp/app/components/ui/icons /myapp/app/components/ui/icons
COPY --from=build /myapp/start.sh /myapp/start.sh

# prepare for litefs
# COPY --from=flyio/litefs:0.5.11 /usr/local/bin/litefs /usr/local/bin/litefs
# ADD other/litefs.yml /etc/litefs.yml
# RUN mkdir -p /data ${LITEFS_DIR}

ADD . .
RUN ["chmod", "+x", "/myapp/start.sh"]
EXPOSE 8080
# CMD ["litefs", "mount"]
ENTRYPOINT [ "./start.sh" ]

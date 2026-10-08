# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0
#
# Runner image for `poc.mjs run --runtime cloud-run-sandbox`.
# The host container only receives uploads and orchestrates; every PoC step
# (dependency install, emulators, the PoC itself) runs inside a Cloud Run
# sandbox (`/usr/local/gcp/bin/sandbox`), which has no access to this
# container's env, secrets or the metadata server.
FROM node:22-bookworm-slim

# Java 17 for the Firestore / Storage / RTDB emulators (Java 24+ is not supported).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates tar coreutils \
 && rm -rf /var/lib/apt/lists/*

ENV FIREBASE_EMULATORS_PATH=/opt/firebase-emulators \
    NO_UPDATE_NOTIFIER=1 \
    NODE_ENV=production

# Pin firebase-tools and pre-download emulator binaries so PoC runs need no egress.
ARG FIREBASE_TOOLS_VERSION=14.9.0
RUN npm install -g --no-fund --no-audit firebase-tools@${FIREBASE_TOOLS_VERSION} \
 && mkdir -p ${FIREBASE_EMULATORS_PATH} \
 && firebase setup:emulators:firestore \
 && firebase setup:emulators:storage \
 && firebase setup:emulators:database \
 && chmod -R a+rX ${FIREBASE_EMULATORS_PATH}

# Pre-installed deps for rules PoCs, so the common case needs no egress at all.
WORKDIR /opt/poc-deps
RUN npm init -y >/dev/null \
 && npm install --no-fund --no-audit --ignore-scripts @firebase/rules-unit-testing@4 firebase@11 \
 && chmod -R a+rX /opt/poc-deps

WORKDIR /app
COPY server.mjs ./
CMD ["node", "server.mjs"]

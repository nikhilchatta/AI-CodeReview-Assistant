# ─────────────────────────────────────────────────────────────────────────────
# AI Code Review Assistant — Backend Dockerfile
#
# Targets EC2 (or any Docker host). The backend runs the Express API server
# on port 5001. sql.js (SQLite/WASM) persists metrics.db to /app/data.
#
# Build:  docker build -t ai-code-review-backend .
# Run:    docker run -d -p 5001:5001 --env-file backend/.env \
#           -v $(pwd)/data:/app/data ai-code-review-backend
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first for layer caching
COPY backend/package*.json ./

# Install all dependencies (tsx is needed at runtime since there is no build step)
RUN npm ci --prefer-offline

# Copy backend source
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Persistent volume for SQLite metrics database
# Mount this directory to preserve data across container restarts:
#   docker run -v /host/data:/app/data ...
# Or on EC2 with docker-compose: use a named volume (see docker-compose.yml)
RUN mkdir -p /app/data

# Expose API port (matches PORT env var default in config/index.ts)
EXPOSE 5001

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production

# Use dumb-init to reap zombie processes and forward signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/tsx", "src/index.ts"]

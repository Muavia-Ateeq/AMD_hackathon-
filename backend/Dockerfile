# backend/Dockerfile
# Multi-stage build, Node 20 alpine, non-root user, health-check, production only

# ---------- Builder stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install all dependencies (including dev) to allow possible build steps
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . ./

# ---------- Runtime stage ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# curl is absent from the alpine base image. Without it the HEALTHCHECK below
# fails with "command not found" and the container reports permanently
# unhealthy regardless of application state.
RUN apk add --no-cache curl

# Install production dependencies only. npm 9 deprecates --only=production in
# favour of --omit=dev.
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code WITHOUT the builder's node_modules. The previous
# `COPY --from=builder /app .` overwrote the pruned tree with the full
# dev-inclusive one, shipping jest and faker into production.
COPY --from=builder /app/src ./src
COPY --from=builder /app/fixtures ./fixtures
COPY --from=builder /app/seed ./seed

# Create non-root user (uid 1000) and switch to it
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup && chown -R nodeuser:nodegroup /app
USER nodeuser

# Expose the HTTP port (configured via env)
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Health-check. /api/health is a liveness probe: it confirms the process is
# serving, not that MongoDB or Evolus are reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Run the server
CMD ["node", "src/server.js"]
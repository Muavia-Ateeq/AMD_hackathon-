# backend/Dockerfile
# Multi‑stage build, Node 20 slim, non‑root user, health‑check, production only

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

# Copy only production‑ready source (exclude dev deps)
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Copy application code (excluding node_modules from builder)
COPY --from=builder /app .

# Create non‑root user (uid 1000) and switch to it
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup && chown -R nodeuser:nodegroup /app
USER nodeuser

# Expose the HTTP port (configured via env)
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Health‑check – use curl (installed in alpine) to probe /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Run the server
CMD ["node", "src/server.js"]

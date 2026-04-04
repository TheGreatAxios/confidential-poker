# ── Stage 1: Build Frontend ──
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx next build

# ── Stage 2: Build Server ──
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx tsc --noEmit  # Verify types

# ── Stage 3: Production ──
FROM node:20-alpine AS production
WORKDIR /app

# Copy server
COPY --from=server-builder /app/server ./server
WORKDIR /app/server

# Copy frontend build
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules

# Install production deps for server
RUN npm ci --omit=dev

EXPOSE 3000 3001

CMD ["sh", "-c", "cd /app/frontend && npx next start -p 3000 & cd /app/server && npx tsx src/index.ts"]

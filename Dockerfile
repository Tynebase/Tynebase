# Multi-stage Dockerfile for TyneBase Backend
# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Remove devDependencies to reduce size
RUN npm prune --production

# Stage 2: Runtime stage
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling, ffmpeg for audio/video processing,
# poppler-utils for PDF-to-image conversion (OCR pipeline),
# and python3/pip for yt-dlp plugins
RUN apk upgrade --no-cache && apk add --no-cache dumb-init ffmpeg poppler-utils python3 py3-pip

# Install yt-dlp PO token provider (non-critical, allow failure)
RUN pip3 install --break-system-packages bgutil-ytdlp-pot-provider || echo "WARNING: bgutil-ytdlp-pot-provider install failed, yt-dlp PO tokens handled by sidecar"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port 8080 (API server)
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command (can be overridden for worker)
CMD ["node", "dist/server.js"]

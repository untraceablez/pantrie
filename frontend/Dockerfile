# Multi-stage build for React frontend

# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1000 pantrie && \
    adduser -D -u 1000 -G pantrie pantrie && \
    chown -R pantrie:pantrie /usr/share/nginx/html && \
    chown -R pantrie:pantrie /var/cache/nginx && \
    chown -R pantrie:pantrie /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R pantrie:pantrie /var/run/nginx.pid

USER pantrie

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

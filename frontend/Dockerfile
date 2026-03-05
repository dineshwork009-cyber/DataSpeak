# ─── Stage 1: Build Angular app ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
RUN npm ci --prefer-offline

# Build production bundle
COPY . .
RUN npm run build

# ─── Stage 2: Nginx ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled Angular app
COPY --from=build /app/dist/dataspeak-frontend/browser /usr/share/nginx/html

# Security headers
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# CloudScope Frontend — Multi-stage Docker Build
# Stage 1: Build React app with Vite
# Stage 2: Serve static files via Nginx

# --- Stage 1: Build ---
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies (layer cached jika package.json tidak berubah)
COPY package.json package-lock.json* ./
RUN npm ci

# Salin source code dan build production bundle
COPY . .
RUN npm run build

# --- Stage 2: Serve via Nginx ---
FROM nginx:1.25-alpine

# Salin build output ke Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Custom Nginx config untuk SPA routing (semua route → index.html)
RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

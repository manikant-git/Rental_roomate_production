# Stage 1: Build React app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install deps - use node 18 + force ajv@8 to fix 'Cannot find module ajv/dist/compile/codegen'
RUN npm install --legacy-peer-deps && \
    npm install ajv@^8.0.0 --legacy-peer-deps

# Copy source code
COPY . .

# Build args for API URL
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the app
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM node:18-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with production flag
RUN npm ci --omit=dev

# Copy remaining files
COPY dist ./dist

# Expose the default port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the server
CMD ["node", "dist/cli.js"] 
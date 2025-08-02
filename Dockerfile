FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src/ ./src/
COPY public/ ./public/

# Expose port
EXPOSE 3113

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3113/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Run the HTTP server
CMD ["node", "src/http-server-direct.js"]
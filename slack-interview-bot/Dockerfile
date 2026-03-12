FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose Next.js port
EXPOSE 3000

# Start script handles DB push + dev server
CMD ["sh", "./scripts/start-dev.sh"]

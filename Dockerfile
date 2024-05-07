# Use a Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy remaining application code
COPY . .

# Set environment variables
ENV PORT=3001
ENV RATELIMIT=20
ENV RATELIMIT_WINDOW=60000
ENV PAYMENT_SERVICE_URL=0.0.0.0:9000
ENV USER_SERVICE_URL=http://localhost:8080
ENV ACCESS_TOKEN_SECRET=secret
ENV REFRESH_TOKEN_SECRET=secret

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]
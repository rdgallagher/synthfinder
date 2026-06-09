FROM node:24-alpine
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/agent/package.json ./packages/agent/

# Install all deps (including devDeps — tsx is needed at runtime to spawn
# the MCP server as a TypeScript child process)
RUN npm ci

# Copy the rest of the source
COPY . .

# Build the Next.js app
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm", "run", "--workspace=packages/agent", "start"]

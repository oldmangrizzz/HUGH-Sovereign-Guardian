FROM node:22-slim

WORKDIR /app

# Install convex CLI globally
RUN npm install -g convex@latest

# Convex auth is stored in ~/.config/convex
# We mount this from the host so auth persists
VOLUME ["/root/.config"]

CMD ["convex", "mcp", "start"]

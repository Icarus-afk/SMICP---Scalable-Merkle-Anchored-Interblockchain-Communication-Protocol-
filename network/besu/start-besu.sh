#!/bin/bash
set -e

# Resolve the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure node directories
mkdir -p node1 node2 node3 keys genesis

# Run initialization to generate keys/genesis/static-nodes
if [ ! -f genesis/genesis.json ] || [ ! -f static-nodes.json ]; then
  echo "Running init-besu.js to generate keys and genesis..."
  if ! command -v node &> /dev/null; then
    echo "node not found. Please install Node.js to continue."
    exit 1
  fi
  node init-besu.js
fi

# Start containers
if ! command -v docker-compose &> /dev/null; then
  echo "docker-compose not found. Please install docker-compose."
  exit 1
fi

echo "Starting Besu nodes..."
docker-compose up -d

echo "Besu nodes starting. Use 'docker ps' to check containers."

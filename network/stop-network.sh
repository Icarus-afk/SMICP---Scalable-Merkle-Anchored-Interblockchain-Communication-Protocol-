#!/bin/bash

# Stop SCIMP Network Script
echo "Stopping SCIMP Hyperledger Fabric Network..."

# Stop and remove containers
docker-compose down --volumes --remove-orphans

# Clean up generated certificates and artifacts
rm -rf organizations/
rm -rf channel-artifacts/
rm -rf wallet/

echo "✓ SCIMP Network stopped and cleaned up successfully!"

#!/bin/bash
# Script to build images, push to registry, and start services
# Usage: ./scripts/build-and-push-images.sh [dev|prod]
# Arguments:
#   dev  - Build for development (uses 'dev' Docker target)
#   prod - Build for production (uses 'prod' Docker target, default)
# Environment variables:
#   REGISTRY_HOST - Registry host (default: localhost:5000)
#   REGISTRY_PORT - Registry port (default: 5000)

set -e

# Parse build target from argument
BUILD_TARGET="${1:-prod}"
if [[ "$BUILD_TARGET" != "dev" && "$BUILD_TARGET" != "prod" ]]; then
  echo "Error: Invalid build target '$BUILD_TARGET'"
  echo "Usage: $0 [dev|prod]"
  exit 1
fi

REGISTRY_HOST="${REGISTRY_HOST:-localhost:5000}"
REGISTRY_PORT="${REGISTRY_PORT:-5000}"
REGISTRY_URL="http://localhost:${REGISTRY_PORT}"

echo "Building for: $BUILD_TARGET"

echo "Starting Docker registry..."
docker-compose up -d registry || {
  echo "Error: Failed to start Docker registry"
  exit 1
}

echo "Waiting for registry to be ready..."
until curl -f "${REGISTRY_URL}/v2/" > /dev/null 2>&1; do
  echo "  Waiting for registry..."
  sleep 2
done
echo "Registry is ready!"

echo "Building and pushing base images..."
# Build and push base images first (they're needed by application images)
docker-compose -f docker-compose.build.yml build shared-base || {
  echo "Error: Failed to build shared-base image"
  exit 1
}
docker push ${REGISTRY_HOST}/shared-base:latest || {
  echo "Error: Failed to push shared-base image"
  echo "If using localhost:5000, ensure Docker is configured with insecure registries."
  exit 1
}

docker-compose -f docker-compose.build.yml build services-base || {
  echo "Error: Failed to build services-base image"
  exit 1
}
docker push ${REGISTRY_HOST}/services-base:latest || {
  echo "Error: Failed to push services-base image"
  echo "If using localhost:5000, ensure Docker is configured with insecure registries."
  exit 1
}

echo "Building application images (target: $BUILD_TARGET)..."
# Build application images (they will pull base images from registry)
BUILD_TARGET=$BUILD_TARGET docker-compose -f docker-compose.build.yml build cluster-manager bot-cluster || {
  echo "Error: Failed to build application images"
  exit 1
}

echo "Pushing application images to registry..."
# Note: For localhost:5000, Docker may need insecure registry configuration
# Add to /etc/docker/daemon.json: {"insecure-registries": ["localhost:5000"]}
docker push ${REGISTRY_HOST}/cluster-manager:latest || {
  echo "Error: Failed to push cluster-manager image"
  echo "If using localhost:5000, ensure Docker is configured with insecure registries."
  echo "   Add to Docker daemon config: {\"insecure-registries\": [\"localhost:5000\"]}"
  exit 1
}
docker push ${REGISTRY_HOST}/bot:latest || {
  echo "Error: Failed to push bot image"
  echo "If using localhost:5000, ensure Docker is configured with insecure registries."
  exit 1
}

echo "Images pushed to registry!"
echo ""
echo "Starting all services..."
if [[ "$BUILD_TARGET" == "dev" ]]; then
  docker-compose -f docker-compose.dev.yml up -d --build || {
    echo "Error: Failed to start services in dev mode"
    exit 1
  }
else
  docker-compose -f docker-compose.yml up -d --build || {
    echo "Error: Failed to start services in prod mode"
    exit 1
  }
fi

echo ""
echo "All services started!"
echo ""
echo "Registry: ${REGISTRY_URL}"
echo "Cluster Manager metrics: http://localhost:3001/metrics"
echo "Grafana: http://localhost:3002"
echo "Prometheus: http://localhost:9090"


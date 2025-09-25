#!/bin/bash

# Discord Bot Platform - Development Stack with Monitoring Startup Script
# This script starts both the development stack and monitoring stack together

set -e  # Exit on any error

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"

# Function to print output
print_status() {
    local message=$1
    echo "$message"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_status "ERROR: Docker is not running. Please start Docker first."
        exit 1
    fi
    print_status "SUCCESS: Docker is running"
}

# Function to check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_status "ERROR: docker-compose is not installed. Please install docker-compose first."
        exit 1
    fi
    print_status "SUCCESS: docker-compose is available"
}

# Function to check if compose file exists
check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_status "ERROR: $COMPOSE_FILE not found in current directory"
        exit 1
    fi
    print_status "SUCCESS: $COMPOSE_FILE found"
}

# Function to create necessary directories
create_directories() {
    print_status "INFO: Creating monitoring directories..."
    
    local dirs=(
        "monitoring/prometheus/rules"
        "monitoring/grafana/provisioning/datasources"
        "monitoring/grafana/provisioning/dashboards"
        "monitoring/grafana/dashboards"
        "monitoring/loki"
        "monitoring/promtail"
        "monitoring/alertmanager"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
    done
    
    # Set proper permissions
    chmod 755 monitoring/grafana/dashboards 2>/dev/null || true
    chmod 644 monitoring/grafana/dashboards/*.json 2>/dev/null || true
    
    print_status "SUCCESS: Directories created successfully"
}

# Function to stop existing containers
stop_existing() {
    print_status "INFO: Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
    print_status "SUCCESS: Existing containers stopped"
}

# Function to start services
start_services() {
    print_status "INFO: Starting development stack with monitoring..."
    
    # Pull latest images
    print_status "INFO: Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Start services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_status "SUCCESS: Services started successfully"
}

# Function to wait for service to be healthy
wait_for_service() {
    local service=$1
    local url=$2
    local timeout=${3:-30}
    
    print_status "INFO: Waiting for $service to be ready..."
    
    local count=0
    while [ $count -lt $timeout ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            print_status "SUCCESS: $service is healthy"
            return 0
        fi
        sleep 2
        count=$((count + 2))
    done
    
    print_status "ERROR: $service failed to start within ${timeout}s"
    return 1
}

# Function to check service health
check_services() {
    print_status "INFO: Checking service health..."
    
    local services_health=(
        "API:http://localhost:3000/health"
        "Dashboard:http://localhost:4200"
        "Prometheus:http://localhost:9090/-/healthy"
        "Grafana:http://localhost:3001/api/health"
        "Loki:http://localhost:3100/ready"
        "Alertmanager:http://localhost:9093/-/healthy"
    )
    
    local failed_services=()
    
    for service_health in "${services_health[@]}"; do
        IFS=':' read -r service url <<< "$service_health"
        if ! wait_for_service "$service" "$url" 15; then
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        print_status "SUCCESS: All services are healthy!"
        return 0
    else
        print_status "WARNING: Some services failed to start: ${failed_services[*]}"
        return 1
    fi
}

# Function to show service status
show_status() {
    print_status "INFO: Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Function to display access information
show_access_info() {
    print_status ""
    print_status "SUCCESS: Development stack with monitoring is ready!"
    print_status ""
    print_status "INFO: Development URLs:"
    print_status "   API:                http://localhost:3000"
    print_status "   Dashboard:          http://localhost:4200"
    print_status "   API Health:         http://localhost:3000/health"
    print_status "   API Metrics:        http://localhost:3000/metrics"
    print_status "   API Docs:           http://localhost:3000/api-docs"
    print_status ""
    print_status "INFO: Monitoring URLs:"
    print_status "   Grafana Dashboard:  http://localhost:3001"
    print_status "   Prometheus:         http://localhost:9090"
    print_status "   Loki:               http://localhost:3100"
    print_status "   Alertmanager:       http://localhost:9093"
    print_status "   Node Exporter:      http://localhost:9100"
    print_status "   Redis Exporter:     http://localhost:9121"
    print_status "   PostgreSQL Exp:     http://localhost:9187"
    print_status "   cAdvisor:           http://localhost:8080"
    print_status ""
    print_status "INFO: Database URLs:"
    print_status "   Redis:              redis://localhost:6379"
    print_status "   PostgreSQL:         postgresql://localhost:5432"
    print_status ""
    print_status "INFO: Default credentials:"
    print_status "   Grafana: admin / admin123"
    print_status ""
    print_status "INFO: Grafana Dashboards:"
    print_status "   - Discord Bot Platform Overview"
    print_status "   - Development Stack Metrics"
    print_status "   - Application Logs"
    print_status "   - Redis Performance"
    print_status "   - Database Performance"
    print_status "   - Container Metrics"
    print_status ""
    print_status "INFO: Useful Commands:"
    print_status "   View logs:          docker-compose -f $COMPOSE_FILE logs -f [service-name]"
    print_status "   Stop all:           docker-compose -f $COMPOSE_FILE down"
    print_status "   Restart service:    docker-compose -f $COMPOSE_FILE restart [service-name]"
    print_status "   View status:        docker-compose -f $COMPOSE_FILE ps"
    print_status "   Scale service:      docker-compose -f $COMPOSE_FILE up -d --scale [service-name]=[count]"
    print_status ""
}

# Function to show logs for failed services
show_failed_logs() {
    if [ $? -ne 0 ]; then
        print_status "INFO: Showing logs for failed services..."
        docker-compose -f "$COMPOSE_FILE" logs --tail=50
    fi
}

# Main execution
main() {
    print_status "INFO: Starting Discord Bot Platform Development Stack with Monitoring..."
    print_status "=================================================="
    
    # Pre-flight checks
    check_docker
    check_docker_compose
    check_compose_file
    
    # Setup
    create_directories
    stop_existing
    
    # Start services
    start_services
    
    # Wait for services to initialize
    print_status "INFO: Waiting for services to initialize..."
    sleep 20
    
    # Check health
    if check_services; then
        show_status
        show_access_info
    else
        show_failed_logs
        print_status "ERROR: Some services failed to start. Check the logs above."
        exit 1
    fi
}

# Handle script interruption
trap 'print_status "ERROR: Script interrupted. Stopping services..."; docker-compose -f "$COMPOSE_FILE" down; exit 1' INT TERM

# Run main function
main "$@"

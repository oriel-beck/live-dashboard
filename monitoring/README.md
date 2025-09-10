# Discord Bot Platform Monitoring

This directory contains the monitoring stack for the Discord Bot Platform, including Prometheus, Grafana, Loki, and various exporters.

## Architecture

The monitoring stack consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Promtail**: Log shipping to Loki
- **Node Exporter**: System metrics (CPU, memory, disk, network)
- **cAdvisor**: Container metrics (CPU, memory, network, filesystem)
- **Redis Exporter**: Redis metrics
- **PostgreSQL Exporter**: Database metrics
- **Alertmanager**: Alert handling

## Quick Start

### Start Monitoring Stack Only
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### Start Full Development Environment with Monitoring
```bash
docker-compose -f docker-compose.dev-with-monitoring.yml up -d
```

## Access Points

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Loki**: http://localhost:3100

## Centralized Metrics Architecture

The bot uses **centralized metrics** for efficient monitoring:

1. **Shard Manager** runs on port `30000` and exposes the metrics API
2. **Individual shards** send their metrics to the manager via HTTP POST
3. **Shard Manager** stores and aggregates metrics from all shards
4. **Prometheus** scrapes only the shard manager's `/metrics` endpoint

This means:
- **Single endpoint** for all bot metrics (`http://bot:30000/metrics`)
- **No port conflicts** - only the manager exposes ports
- **Automatic shard labeling** - each metric includes `shard_id` label
- **Efficient resource usage** - no multiple HTTP servers
- **Reliable communication** - shards push metrics every 10 seconds

## Debugging Metrics Aggregation

If metrics aren't being aggregated properly, check:

1. **View aggregated metrics**: `http://localhost:30000/metrics`
2. **Check bot logs** for shard communication errors
3. **Verify shard manager** is receiving metrics from shards

The system will show you:
- Which shards are sending metrics to the manager
- Any communication errors between shards and manager
- Metrics aggregation status in the logs

## Metrics Endpoints

The following services expose metrics:

- **API**: `http://api:3000/metrics`
- **Bot (All Shards)**: `http://bot:30000/metrics` (aggregated)
- **Node Exporter**: `http://node-exporter:9100/metrics`
- **cAdvisor**: `http://cadvisor:8080/metrics`
- **Redis Exporter**: `http://redis-exporter:9121/metrics`
- **PostgreSQL Exporter**: `http://postgres-exporter:9187/metrics`

## Available Metrics

### Application Metrics (API & Bot)

#### HTTP Metrics
- `http_requests_total`: Total HTTP requests by method, route, and status code
- `http_request_duration_seconds`: HTTP request duration histogram
- `http_request_errors_total`: HTTP request errors by type

#### Bot Metrics
- `commands_executed_total`: Total commands executed by command name and guild
- `command_execution_duration_seconds`: Command execution duration histogram
- `guild_count`: Number of guilds the bot is in
- `user_count`: Number of users the bot can see

#### System Metrics
- `memory_usage_bytes`: Memory usage by type (RSS, heap, external)
- `cpu_usage_percent`: CPU usage percentage

#### Redis Metrics
- `redis_pubsub_messages_published_total`: Redis pub/sub messages published
- `redis_pubsub_messages_delivered_total`: Redis pub/sub messages delivered
- `redis_connection_status`: Redis connection status

#### SSE Metrics
- `sse_active_connections`: Active Server-Sent Events connections

### Container Metrics (cAdvisor)

- `container_cpu_usage_seconds_total`: Container CPU usage
- `container_memory_usage_bytes`: Container memory usage
- `container_network_receive_bytes_total`: Container network receive
- `container_network_transmit_bytes_total`: Container network transmit
- `container_fs_usage_bytes`: Container filesystem usage

### System Metrics (Node Exporter)

- `node_cpu_seconds_total`: CPU time by mode
- `node_memory_MemTotal_bytes`: Total memory
- `node_memory_MemAvailable_bytes`: Available memory
- `node_disk_io_time_seconds_total`: Disk I/O time
- `node_network_receive_bytes_total`: Network receive
- `node_network_transmit_bytes_total`: Network transmit

## Dashboards

### Discord Bot Platform - Enhanced Monitoring

The main dashboard includes:

1. **API Metrics**
   - Request rate by method and route
   - Response time percentiles
   - Request status distribution

2. **Bot Metrics**
   - Commands executed over time
   - Guild and user counts
   - Command execution duration

3. **System Metrics**
   - System CPU and memory usage
   - Container CPU and memory usage per service

4. **Infrastructure Metrics**
   - Redis pub/sub activity
   - SSE connections
   - Database metrics

## Troubleshooting

### No Data in Grafana

1. **Check if services are running**:
   ```bash
   docker ps --filter "name=prometheus" --filter "name=grafana"
   ```

2. **Check Prometheus targets**:
   - Go to http://localhost:9090/targets
   - Verify all targets are UP and healthy

3. **Check metrics endpoints**:
   ```bash
   # Test API metrics
   curl http://localhost:3000/metrics
   
   # Test aggregated bot metrics (all shards)
   curl http://localhost:30000/metrics
   ```

4. **Check logs**:
   ```bash
   docker logs prometheus
   docker logs grafana
   ```

### Common Issues

1. **"No data" in panels**: Usually means the metric name doesn't exist or the service isn't running
2. **Connection refused**: Service isn't running or port isn't exposed
3. **Permission denied**: Check Docker volume mounts and permissions

### Adding New Metrics

1. **In your application**:
   ```typescript
   import { Counter, Histogram, Gauge } from 'prom-client';
   
   const myCounter = new Counter({
     name: 'my_metric_total',
     help: 'Description of my metric',
     labelNames: ['label1', 'label2']
   });
   
   // Use the metric
   myCounter.inc({ label1: 'value1' });
   ```

2. **Update Prometheus config** if needed (usually not required for application metrics)

3. **Add to Grafana dashboard**:
   - Create new panel
   - Use the metric name in queries
   - Configure visualization

## Configuration Files

- `prometheus/prometheus.yml`: Prometheus configuration
- `grafana/dashboards/`: Dashboard definitions
- `grafana/provisioning/`: Grafana provisioning config
- `loki/loki-config.yml`: Loki configuration
- `promtail/promtail-config.yml`: Promtail configuration
- `alertmanager/alertmanager.yml`: Alertmanager configuration

## Development

### Adding New Exporters

1. Add service to `docker-compose.monitoring.yml`
2. Add scrape config to `prometheus/prometheus.yml`
3. Update this README with new metrics

### Custom Dashboards

1. Create dashboard JSON in `grafana/dashboards/`
2. Add to `grafana/provisioning/dashboards/dashboards.yml`
3. Restart Grafana to load the dashboard

## Security Notes

- Default Grafana credentials are `admin/admin123` - change in production
- Monitoring services are on a separate Docker network
- Consider adding authentication for production deployments

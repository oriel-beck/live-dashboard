import { ClusterManager as HybridClusterManager } from "discord-hybrid-sharding";
import express from "express";
import logger from "../utils/logger";

export class ClusterManager {
  private manager: HybridClusterManager;
  private metricsServer: any;
  private clusterMetrics = new Map<number, any>();

  constructor() {
    // Use TypeScript file for development, compiled JS for production
    const botFile = process.env.NODE_ENV === 'production' ? './dist/bot.js' : './src/bot.ts';
    
    this.manager = new HybridClusterManager(botFile, {
      shardsPerClusters: 16,
      mode: "process",
      token: process.env.BOT_TOKEN!,
      restarts: {
        max: 3,
        interval: 60000,
      },
    });

    this.setupEvents();
  }

  private setupEvents() {
    this.manager.on("clusterCreate", (cluster) => {
      const shardRange = `${cluster.id * 16}-${(cluster.id * 16) + 15}`;
      logger.info(`[ClusterManager] Launched cluster ${cluster.id} (shards ${shardRange})`);
    });

    this.manager.on("clusterReady", (cluster) => {
      logger.info(`[ClusterManager] Cluster ${cluster.id} is ready`);
    });

    this.manager.on("clusterReconnecting", (cluster) => {
      logger.warn(`[ClusterManager] Cluster ${cluster.id} is reconnecting`);
    });

    this.manager.on("clusterDisconnect", (cluster) => {
      logger.warn(`[ClusterManager] Cluster ${cluster.id} disconnected`);
    });

    this.manager.on("clusterSpawn", (cluster) => {
      logger.info(`[ClusterManager] Spawning cluster ${cluster.id}`);
    });

    // Add error handling for large-scale deployments
    this.manager.on("debug", (message) => {
      logger.debug(`[ClusterManager] ${message}`);
    });

    this.manager.on("error", (error) => {
      logger.error(`[ClusterManager] Error:`, error);
    });
  }

  private async setupMetricsServer() {
    const app = express();
    const port = process.env.METRICS_PORT || 3001;

    app.use(express.json());

    // Endpoint for clusters to send their metrics
    app.post("/cluster-metrics", (req, res) => {
      const { clusterId, metrics } = req.body;
      if (clusterId !== undefined && metrics) {
        this.clusterMetrics.set(clusterId, metrics);
        logger.debug(
          `[ClusterManager] Received metrics from cluster ${clusterId}`
        );
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid metrics data" });
      }
    });

    // Main metrics endpoint for Prometheus
    app.get("/metrics", async (req, res) => {
      try {
        const { register } = await import("../utils/metrics");
        
        // Start with manager-level metrics only (no cluster duplication)
        let aggregatedMetrics = await register.metrics();
        
        // Aggregate cluster metrics without duplication
        logger.debug(
          `[ClusterManager] Aggregating metrics from ${this.clusterMetrics.size} clusters`
        );

        // Let Prometheus aggregate metrics with sum() queries

        // Deduplicate and aggregate cluster metrics properly
        const metricsByName = new Map<string, string[]>();
        
        for (const [clusterId, metrics] of this.clusterMetrics) {
          try {
            const lines = metrics.split("\n");
            for (const line of lines) {
              if (line.startsWith("#") || line.trim() === "") continue;
              
              const metricName = line.split(/[{\s]/)[0];
              // Include all bot metrics (cluster, command, etc.)
              if (metricName.startsWith("bot_")) {
                // Add cluster_id label if not already present for cluster metrics
                let processedLine = line;
                if (metricName.startsWith("bot_cluster_") && !line.includes("cluster_id=")) {
                  const spaceIndex = line.indexOf(" ");
                  if (spaceIndex > 0) {
                    const metric = line.substring(0, spaceIndex);
                    const value = line.substring(spaceIndex);
                    
                    if (metric.includes("{")) {
                      processedLine = metric.replace("}", `,cluster_id="${clusterId}"}`) + value;
                    } else {
                      processedLine = `${metric}{cluster_id="${clusterId}"}${value}`;
                    }
                  }
                } else {
                  // For command metrics and others, use as-is (they already have cluster_id)
                  processedLine = line;
                }
                
                if (!metricsByName.has(metricName)) {
                  metricsByName.set(metricName, []);
                }
                metricsByName.get(metricName)!.push(processedLine);
              }
            }
          } catch (error) {
            logger.warn(
              `[ClusterManager] Failed to process metrics from cluster ${clusterId}:`,
              error
            );
          }
        }

        // Add all unique cluster metrics
        for (const [metricName, lines] of metricsByName) {
          aggregatedMetrics += "\n" + lines.join("\n");
        }

        res.set("Content-Type", register.contentType);
        res.end(aggregatedMetrics);
      } catch (error) {
        logger.error("[ClusterManager] Error serving metrics:", error);
        res.status(500).end(String(error));
      }
    });

    return app.listen(port, () => {
      logger.info(`[ClusterManager] Metrics server running on port ${port}`);
    });
  }


  async start() {
    logger.info("[ClusterManager] Starting cluster manager...");

    this.metricsServer = await this.setupMetricsServer();
    
    logger.info(`[ClusterManager] Using 300ms delay between cluster spawns for ${this.manager.totalShards} shards`);
    await this.manager.spawn({ timeout: -1, delay: 300 });

    logger.info(
      `[ClusterManager] Started ${this.manager.totalClusters} clusters managing ${this.manager.totalShards} shards`
    );

    // Set up periodic health checks
    this.startHealthChecks();
  }

  private startHealthChecks() {
    setInterval(async () => {
      for (const [id, cluster] of this.manager.clusters) {
        try {
          const isReady = await cluster.eval("this.readyAt !== null", {}, 5000);
          if (!isReady) {
            logger.warn(`[ClusterManager] Cluster ${id} appears unhealthy`);
          }
        } catch (error) {
          logger.error(
            `[ClusterManager] Health check failed for cluster ${id}:`,
            error
          );
        }
      }
    }, 30000); // Check every 30 seconds
  }

  async stop() {
    logger.info("[ClusterManager] Stopping cluster manager...");

    if (this.metricsServer) {
      this.metricsServer.close();
    }

    // Stop all clusters gracefully
    for (const [id, cluster] of this.manager.clusters) {
      try {
        cluster.kill({ force: true });
        logger.info(`[ClusterManager] Stopped cluster ${id}`);
      } catch (error) {
        logger.error(`[ClusterManager] Error stopping cluster ${id}:`, error);
      }
    }
  }
}

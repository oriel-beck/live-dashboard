import { ClusterManager as HybridClusterManager } from "discord-hybrid-sharding";
import express from "express";
import logger from "../utils/logger";
import type { ClusterInfo, ClusterMetrics } from "./types";

export class ClusterManager {
  private manager: HybridClusterManager;
  private metricsServer: any;
  private clusterMetrics = new Map<number, any>();

  constructor() {
    // Use TypeScript file for development, compiled JS for production
    const botFile = process.env.NODE_ENV === 'production' ? './dist/bot.js' : './src/bot.ts';
    
    this.manager = new HybridClusterManager(botFile, {
      totalShards: "auto",
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
      logger.info(`[ClusterManager] Launched cluster ${cluster.id}`);
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
        let aggregatedMetrics = await register.metrics();

        // Aggregate cluster metrics
        logger.debug(
          `[ClusterManager] Aggregating metrics from ${this.clusterMetrics.size} clusters`
        );

        for (const [clusterId, metrics] of this.clusterMetrics) {
          try {
            const labeledMetrics = this.addClusterLabels(metrics, clusterId);
            aggregatedMetrics += "\n" + labeledMetrics;
          } catch (error) {
            logger.warn(
              `[ClusterManager] Failed to process metrics from cluster ${clusterId}:`,
              error
            );
          }
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

  private addClusterLabels(metrics: string, clusterId: number): string {
    return metrics
      .split("\n")
      .map((line) => {
        if (line.startsWith("#") || line.trim() === "") return line;

        // Skip if line already has cluster_id label
        if (line.includes("cluster_id=")) return line;

        // Add cluster_id to bot metrics that don't already have it
        const metricName = line.split(" ")[0];
        if (metricName.startsWith("bot_") && !line.includes("{")) {
          // Add cluster_id to unlabeled bot metrics
          const parts = line.split(" ");
          if (parts.length >= 2) {
            return `${parts[0]}{cluster_id="${clusterId}"} ${parts
              .slice(1)
              .join(" ")}`;
          }
        }

        return line;
      })
      .join("\n");
  }

  async start() {
    logger.info("[ClusterManager] Starting cluster manager...");

    this.metricsServer = await this.setupMetricsServer();
    
    // Start clusters
    await this.manager.spawn({ timeout: -1 });

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

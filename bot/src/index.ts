// Load environment variables first
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env") });

import { ShardingManager } from "discord.js";
import logger from "./utils/logger";

// Enable sharding by default (can be disabled with USE_SHARDING=false)
const useSharding = process.env.USE_SHARDING !== "false";

if (useSharding) {
  // Sharding mode - create ShardingManager
  const manager = new ShardingManager(resolve(__dirname, "bot.ts"), {
    token: process.env.BOT_TOKEN!,
    totalShards: "auto", // Auto-scale based on guild count
    respawn: true,
  });

  manager.on("shardCreate", (shard) => {
    logger.info(`[ShardManager] Launched shard ${shard.id}`);
  });

  // Setup metrics server for shard manager
  const express = require("express");
  const app = express();
  const port = process.env.METRICS_PORT || 3001;

  // Add JSON body parsing middleware
  app.use(express.json());

  // Store metrics from shards
  const shardMetrics = new Map<number, string>();

  // Endpoint for shards to send their metrics
  app.post("/shard-metrics", (req: any, res: any) => {
    try {
      const shardId = req.body.shardId;
      const metrics = req.body.metrics;
      
      if (shardId !== undefined && metrics) {
        shardMetrics.set(shardId, metrics);
        logger.debug(`[ShardManager] Received metrics from shard ${shardId}`);
        res.status(200).json({ success: true });
      } else {
        res.status(400).json({ error: "Missing shardId or metrics" });
      }
    } catch (error) {
      logger.error("[ShardManager] Error receiving shard metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/metrics", async (req: any, res: any) => {
    try {
      const { register } = await import("./utils/metrics");

      // Get shard manager metrics
      let metrics = await register.metrics();

      // Aggregate metrics from all shards
      logger.debug(`[ShardManager] Aggregating metrics from ${shardMetrics.size} shards`);

      for (const [shardId, shardMetricsData] of shardMetrics) {
        try {
          // Process shard metrics and add shard_id labels where appropriate
          const labeledMetrics = shardMetricsData
            .split("\n")
            .map((line) => {
              if (line.startsWith("#") || line.trim() === "") return line;
              
              // Skip if line already has shard_id label
              if (line.includes('shard_id=')) return line;
              
              // Add shard_id to bot metrics that don't already have it
              const metricName = line.split(' ')[0];
              if (metricName.startsWith('bot_') && !line.includes('{')) {
                // Add shard_id to unlabeled bot metrics
                const parts = line.split(" ");
                if (parts.length >= 2) {
                  return `${parts[0]}{shard_id="${shardId}"} ${parts.slice(1).join(" ")}`;
                }
              }
              
              return line;
            })
            .join("\n");
          metrics += "\n" + labeledMetrics;
        } catch (error) {
          logger.warn(`[ShardManager] Failed to process metrics from shard ${shardId}:`, error);
        }
      }

      res.set("Content-Type", register.contentType);
      res.end(metrics);
    } catch (error) {
      res.status(500).end(String(error));
    }
  });

  app.listen(port, () => {
    logger.info(`[ShardManager] Metrics server running on port ${port}`);
  });

  // Start the shard manager
  manager
    .spawn()
    .then(() => {
      logger.info(`[ShardManager] Started ${manager.totalShards} shards`);
    })
    .catch((error) => {
      logger.error("[ShardManager] Failed to start shards:", error);
      process.exit(1);
    });
} else {
  // Single instance mode - import and run bot directly
  require("./bot");
}

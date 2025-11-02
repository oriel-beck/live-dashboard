import { CLUSTER_EVENTS } from "@discord-bot/shared-types";
import Docker from "dockerode";
import { Elysia } from "elysia";
import { DiscordGatewayService } from "./services/discord-gateway";
import { RabbitMQService } from "./services/rabbitmq";
import { ShardAssignmentService } from "./services/shard-assignment";
import {
  ClusterConfig,
  ClusterInfo,
  ClusterInstance,
  ClusterStatus,
} from "./types/cluster";
import { ShardDistribution } from "./types/shard";
import logger from "./utils/logger";

// Docker configuration constants
const DOCKER_PROJECT_PREFIX =
  process.env.DOCKER_PROJECT_PREFIX || "clustered-bot";
const DOCKER_NETWORK_NAME = `${DOCKER_PROJECT_PREFIX}_app-network`;
const CONTAINER_NAME_PREFIX = process.env.CONTAINER_PREFIX || "bot-cluster";

export class ClusterManager {
  private docker: Docker | null = null;
  private containers = new Map<number, string>(); // clusterId -> containerId
  private clusters = new Map<number, ClusterInstance>();
  private metricsServer: any;
  private clusterMetrics = new Map<number, any>();
  private isRunning = false;
  private currentDistribution: ShardDistribution | null = null;

  // Services
  private discordGateway: DiscordGatewayService;
  private shardAssignment: ShardAssignmentService;
  private rabbitMQ: RabbitMQService;

  // Configuration
  private readonly imageName: string;
  private readonly startupDelay: number;
  private readonly readyTimeout: number;
  private readonly healthCheckInterval: number;
  private useSwarm: boolean;

  constructor() {
    // Initialize services
    this.discordGateway = new DiscordGatewayService();
    this.shardAssignment = new ShardAssignmentService();
    this.rabbitMQ = new RabbitMQService();

    // Configuration
    this.imageName =
      process.env.DOCKER_IMAGE_NAME ||
      "bot:latest";
    this.startupDelay = parseInt(process.env.CLUSTER_STARTUP_DELAY || "5000");
    this.readyTimeout = parseInt(process.env.CLUSTER_READY_TIMEOUT || "30000");
    this.healthCheckInterval = parseInt(
      process.env.CLUSTER_HEALTH_CHECK_INTERVAL || "5000"
    );

    // Runtime detection will be done in start() method
    this.useSwarm = false; // Will be set during startup

    logger.info("[ClusterManager] Initialized");
  }

  /**
   * Start the cluster manager
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("[ClusterManager] Already running");
      return;
    }

    try {
      logger.info("[ClusterManager] Starting cluster manager...");

      // Detect Docker availability
      const dockerAvailable = await this.detectDockerAvailability();
      if (!dockerAvailable) {
        throw new Error(
          "Docker is not available. Please ensure Docker is installed and running."
        );
      }

      // Initialize Docker
      this.docker = new Docker({
        socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
      });
      logger.info("[ClusterManager] Docker client initialized");

      // Detect Swarm availability
      this.useSwarm = await this.detectSwarmAvailability();
      logger.info(
        `[ClusterManager] Runtime detected - Swarm: ${this.useSwarm}`
      );

      // Clean up any orphaned containers from previous runs
      await this.cleanupOrphanedContainers();

      // Connect to RabbitMQ with retry logic (RabbitMQ may be marked healthy but AMQP port may not be ready)
      const maxRetries = 10;
      const baseDelay = 2000; // 2 seconds
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`[ClusterManager] RabbitMQ connection attempt ${attempt}/${maxRetries}...`);
          await this.rabbitMQ.connect();
          await this.rabbitMQ.initializeDefaults();
          await this.setupRabbitMQHandlers();
          logger.info('[ClusterManager] RabbitMQ connected successfully');
          break; // Success, exit retry loop
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (attempt === maxRetries) {
            logger.error('[ClusterManager] Failed to connect to RabbitMQ after all retries:', {
              message: errorMessage,
              error: error
            });
            throw error;
          }
          
          logger.warn(`[ClusterManager] RabbitMQ connection attempt ${attempt} failed:`, errorMessage);
          
          // Exponential backoff with jitter
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Start metrics server
      this.metricsServer = await this.setupMetricsServer();

      // Get Discord gateway information
      const gatewayInfo = await this.discordGateway.getGatewayInfo();
      const totalShards = gatewayInfo.shards;
      const maxConcurrency = gatewayInfo.session_start_limit.max_concurrency;

      logger.info(
        `[ClusterManager] Discord gateway info - Shards: ${totalShards}, Max Concurrency: ${maxConcurrency}`
      );

      // Set environment variable for clusters
      process.env.TOTAL_SHARDS = totalShards.toString();

      // Calculate shard distribution with Discord max concurrency
      this.currentDistribution =
        this.shardAssignment.calculateShardDistribution(
          totalShards,
          undefined,
          maxConcurrency
        );

      // Validate distribution
      if (
        !this.shardAssignment.validateShardDistribution(
          this.currentDistribution
        )
      ) {
        throw new Error("Invalid shard distribution calculated");
      }

      logger.info(
        `[ClusterManager] Calculated distribution: ${this.currentDistribution.totalClusters} clusters, ${this.currentDistribution.shardsPerCluster} shards per cluster`
      );

      // Start clusters with proper timing
      await this.startClusters();

      // Start health check monitoring
      this.startHealthCheckMonitoring();

      this.isRunning = true;
      logger.info("[ClusterManager] Cluster manager started successfully");
    } catch (error) {
      logger.error("[ClusterManager] Failed to start:", error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop the cluster manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("[ClusterManager] Not running");
      return;
    }

    try {
      logger.info("[ClusterManager] Stopping cluster manager...");

      // Stop all clusters
      const clusterIds = Array.from(this.clusters.keys());
      if (clusterIds.length > 0) {
        await this.stopClustersWithTiming(clusterIds);
      }

      // Disconnect from RabbitMQ
      await this.rabbitMQ.disconnect();

      // Stop metrics server
      if (this.metricsServer) {
        this.metricsServer.close();
      }

      this.isRunning = false;
      this.currentDistribution = null;
      this.clusters.clear();
      this.containers.clear();

      logger.info("[ClusterManager] Cluster manager stopped successfully");
    } catch (error) {
      logger.error("[ClusterManager] Error during shutdown:", error);
    }
  }

  /**
   * Scale clusters based on Discord recommendations
   */
  async scaleClusters(): Promise<void> {
    try {
      logger.info("[ClusterManager] Scaling clusters...");

      // Get fresh gateway info
      const gatewayInfo = await this.discordGateway.getGatewayInfo();
      const newTotalShards = gatewayInfo.shards;

      if (!this.currentDistribution) {
        logger.warn("[ClusterManager] No current distribution, starting fresh");
        await this.start();
        return;
      }

      // Check if scaling is needed
      if (this.currentDistribution.totalShards === newTotalShards) {
        logger.info(
          "[ClusterManager] No scaling needed, shard count unchanged"
        );
        return;
      }

      logger.info(
        `[ClusterManager] Scaling from ${this.currentDistribution.totalShards} to ${newTotalShards} shards`
      );

      // Update environment variable
      process.env.TOTAL_SHARDS = newTotalShards.toString();

      // Calculate new distribution with Discord max concurrency
      const newDistribution = this.shardAssignment.calculateShardDistribution(
        newTotalShards,
        undefined,
        gatewayInfo.session_start_limit.max_concurrency
      );

      // Get current clusters
      const currentClusters = Array.from(this.clusters.values());

      // Determine which clusters to add, remove, or modify
      const clustersToAdd: number[] = [];
      const clustersToRemove: number[] = [];
      const clustersToModify: { id: number; newShards: number[] }[] = [];

      logger.debug(`[ClusterManager] Current distribution: ${this.currentDistribution.totalClusters} clusters, ${this.currentDistribution.totalShards} shards`);
      logger.debug(`[ClusterManager] New distribution: ${newDistribution.totalClusters} clusters, ${newDistribution.totalShards} shards`);

      // Find clusters to add
      for (
        let clusterId = 0;
        clusterId < newDistribution.totalClusters;
        clusterId++
      ) {
        const newShards = newDistribution.clusterShards.get(clusterId) || [];
        const existingCluster = currentClusters.find((c) => c.id === clusterId);

        if (!existingCluster) {
          clustersToAdd.push(clusterId);
        } else {
          const currentShards = existingCluster.shards;
          if (!this.arraysEqual(currentShards, newShards)) {
            clustersToModify.push({ id: clusterId, newShards });
          }
        }
      }

      // Find clusters to remove
      for (const cluster of currentClusters) {
        if (cluster.id >= newDistribution.totalClusters) {
          clustersToRemove.push(cluster.id);
        }
      }

      // Execute scaling operations
      if (clustersToRemove.length > 0) {
        logger.info(
          `[ClusterManager] Removing ${clustersToRemove.length} clusters`
        );
        await this.stopClustersWithTiming(clustersToRemove);
      }

      if (clustersToModify.length > 0) {
        logger.info(
          `[ClusterManager] Modifying ${clustersToModify.length} clusters`
        );
        for (const { id, newShards } of clustersToModify) {
          await this.restartClusterWithTiming(id, newShards);
        }
      }

      if (clustersToAdd.length > 0) {
        logger.info(`[ClusterManager] Scaling plan - adding ${clustersToAdd.length} clusters, removing ${clustersToRemove.length} clusters, modifying ${clustersToModify.length} clusters`);
        logger.debug(`[ClusterManager] Clusters to add: [${clustersToAdd.join(", ")}]`);
        logger.debug(`[ClusterManager] Clusters to remove: [${clustersToRemove.join(", ")}]`);
        logger.debug(`[ClusterManager] Clusters to modify: [${clustersToModify.map(c => `${c.id}(${c.newShards.length} shards)`).join(", ")}]`);
        for (const clusterId of clustersToAdd) {
          const shards = newDistribution.clusterShards.get(clusterId) || [];
          await this.createCluster(clusterId, shards);

          // Wait between cluster starts
          if (clustersToAdd.indexOf(clusterId) < clustersToAdd.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.startupDelay)
            );
          }
        }
      }

      // Update current distribution
      this.currentDistribution = newDistribution;

      logger.info("[ClusterManager] Cluster scaling completed successfully");
    } catch (error) {
      logger.error("[ClusterManager] Failed to scale clusters:", error);
      throw error;
    }
  }

  /**
   * Perform rolling restart of a specific cluster
   */
  async rollingRestart(clusterId: number): Promise<void> {
    try {
      logger.info(
        `[ClusterManager] Starting rolling restart for cluster ${clusterId}`
      );

      const cluster = this.clusters.get(clusterId);
      if (!cluster) {
        throw new Error(`Cluster ${clusterId} not found`);
      }

      await this.restartClusterWithTiming(clusterId, cluster.shards);

      logger.info(
        `[ClusterManager] Rolling restart completed for cluster ${clusterId}`
      );
    } catch (error) {
      logger.error(
        `[ClusterManager] Rolling restart failed for cluster ${clusterId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a cluster (Docker container)
   */
  private async createCluster(
    clusterId: number,
    shards: number[]
  ): Promise<ClusterInstance> {
    logger.info(
      `[ClusterManager] Creating cluster ${clusterId} with shards [${shards.join(
        ", "
      )}]`
    );

    // Check if cluster already exists
    if (this.clusters.has(clusterId)) {
      throw new Error(`Cluster ${clusterId} already exists`);
    }

    let containerId: string;

    try {
      // Use Docker containers
      if (this.useSwarm) {
        containerId = await this.createSwarmService(clusterId, shards);
      } else {
        containerId = await this.createDockerContainer(clusterId, shards);
      }

      // Create cluster instance
      const instance: ClusterInstance = {
        id: clusterId,
        shards,
        status: {
          id: clusterId,
          isRunning: true,
          isReady: false,
          health: "unknown",
          uptime: 0,
          shardStatus: shards.map((shardId) => ({
            shardId,
            isConnected: false,
            latency: 0,
            guildCount: 0,
            userCount: 0,
            lastHeartbeat: new Date(),
          })),
        },
        containerId,
        startTime: new Date(),
        lastHealthCheck: new Date(),
      };

      // Store the cluster
      this.clusters.set(clusterId, instance);
      this.containers.set(clusterId, containerId);
      logger.debug(`[ClusterManager] Cluster ${clusterId} stored - containerId: ${containerId}`);

      // Wait for cluster to be ready
      logger.info(`[ClusterManager] Waiting for cluster ${clusterId} to become ready (timeout: ${this.readyTimeout}ms)`);
      const isReady = await this.waitForClusterReady(clusterId);
      if (!isReady) {
        logger.error(`[ClusterManager] Cluster ${clusterId} failed to become ready within ${this.readyTimeout}ms`);
        await this.stopCluster(clusterId);
        throw new Error(
          `Cluster ${clusterId} failed to become ready within timeout`
        );
      }

      logger.info(`[ClusterManager] Cluster ${clusterId} created successfully and is ready`);
      return instance;
    } catch (error) {
      logger.error(
        `[ClusterManager] Failed to create cluster ${clusterId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Stop a cluster
   */
  private async stopCluster(clusterId: number): Promise<void> {
    logger.info(`[ClusterManager] Stopping cluster ${clusterId}`);

    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      logger.warn(`[ClusterManager] Cluster ${clusterId} not found`);
      return;
    }

    try {
      if (this.useSwarm) {
        await this.removeSwarmService(clusterId);
      } else {
        await this.stopDockerContainer(cluster.containerId!);
      }
    } catch (error) {
      logger.error(
        `[ClusterManager] Error stopping cluster ${clusterId}:`,
        error
      );
    } finally {
      // Clean up
      this.clusters.delete(clusterId);
      this.containers.delete(clusterId);
    }
  }

  /**
   * Get cluster status by ID
   */
  private async getClusterStatusById(
    clusterId: number
  ): Promise<ClusterStatus> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      logger.warn(`[ClusterManager] Cluster ${clusterId} not found in clusters map`);
      throw new Error(`Cluster ${clusterId} not found`);
    }

    if (cluster.containerId) {
      return this.getDockerClusterStatus(clusterId, cluster.containerId);
    } else {
      logger.debug(`[ClusterManager] Cluster ${clusterId} has no containerId, marking as unhealthy`);
      cluster.status.isRunning = false;
      cluster.status.isReady = false;
      cluster.status.health = "unhealthy";
      return cluster.status;
    }
  }

  /**
   * List all clusters
   */
  private async listClusters(): Promise<ClusterInfo[]> {
    const clusters: ClusterInfo[] = [];

    for (const [clusterId, instance] of this.clusters) {
      const status = await this.getClusterStatusById(clusterId);
      const config: ClusterConfig = {
        shards: instance.shards,
        environment: {
          CLUSTER_ID: clusterId.toString(),
          SHARD_LIST: JSON.stringify(instance.shards),
          TOTAL_SHARDS: process.env.TOTAL_SHARDS!,
        },
      };

      clusters.push({
        id: clusterId,
        shards: instance.shards,
        status,
        runtime: this.useSwarm ? "swarm" : "docker",
        config,
      });
    }

    return clusters;
  }

  /**
   * Restart cluster with timing
   */
  private async restartClusterWithTiming(
    clusterId: number,
    shards: number[]
  ): Promise<void> {
    logger.info(`[ClusterManager] Restarting cluster ${clusterId}`);

    // Stop the cluster
    await this.stopCluster(clusterId);

    // Wait a moment before restarting
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start the cluster again
    await this.createCluster(clusterId, shards);
  }

  /**
   * Stop clusters with timing
   */
  private async stopClustersWithTiming(clusterIds: number[]): Promise<void> {
    logger.info(`[ClusterManager] Stopping ${clusterIds.length} clusters`);

    // Stop clusters in reverse order
    const reversedIds = [...clusterIds].reverse();

    for (const clusterId of reversedIds) {
      try {
        await this.stopCluster(clusterId);

        // Small delay between stops
        if (reversedIds.indexOf(clusterId) < reversedIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(
          `[ClusterManager] Error stopping cluster ${clusterId}:`,
          error
        );
      }
    }
  }

  /**
   * Wait for cluster to be ready
   */
  private async waitForClusterReady(clusterId: number): Promise<boolean> {
    const startTime = Date.now();
    let checkCount = 0;

    logger.debug(`[ClusterManager] Starting readiness check for cluster ${clusterId} (checking every 1s, timeout: ${this.readyTimeout}ms)`);

    while (Date.now() - startTime < this.readyTimeout) {
      checkCount++;
      const elapsed = Date.now() - startTime;
      
      try {
        const status = await this.getClusterStatusById(clusterId);
        
        logger.debug(`[ClusterManager] Cluster ${clusterId} readiness check ${checkCount} - running: ${status.isRunning}, ready: ${status.isReady}, health: ${status.health}, elapsed: ${elapsed}ms`);
        
        if (status.isReady && status.health === "healthy") {
          logger.info(`[ClusterManager] Cluster ${clusterId} is ready (after ${elapsed}ms, ${checkCount} checks)`);
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const elapsed = Date.now() - startTime;
        logger.debug(
          `[ClusterManager] Cluster ${clusterId} readiness check ${checkCount} failed (elapsed: ${elapsed}ms):`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const elapsed = Date.now() - startTime;
    logger.warn(
      `[ClusterManager] Cluster ${clusterId} failed to become ready within ${this.readyTimeout}ms (elapsed: ${elapsed}ms, checks: ${checkCount})`
    );
    return false;
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheckMonitoring(): void {
    logger.info(`[ClusterManager] Starting periodic health check monitoring (interval: ${this.healthCheckInterval}ms)`);
    
    setInterval(async () => {
      const clusterIds = Array.from(this.clusters.keys());
      logger.debug(`[ClusterManager] Running health check for ${clusterIds.length} clusters: [${clusterIds.join(", ")}]`);
      
      for (const [clusterId] of this.clusters) {
        try {
          const status = await this.getClusterStatusById(clusterId);
          if (!status.isRunning || status.health !== "healthy") {
            logger.warn(
              `[ClusterManager] Cluster ${clusterId} health check failed - running: ${status.isRunning}, health: ${status.health}`
            );
          } else {
            logger.debug(`[ClusterManager] Cluster ${clusterId} health check passed - uptime: ${status.uptime}ms`);
          }
        } catch (error) {
          logger.error(
            `[ClusterManager] Health check error for cluster ${clusterId}:`,
            error
          );
        }
      }
    }, this.healthCheckInterval);

    logger.info(
      `[ClusterManager] Started health check monitoring (interval: ${this.healthCheckInterval}ms)`
    );
  }

  /**
   * Start all clusters based on current distribution
   */
  private async startClusters(): Promise<void> {
    if (!this.currentDistribution) {
      throw new Error("No shard distribution available");
    }

    // Get max concurrency from Discord API
    const gatewayInfo = await this.discordGateway.getGatewayInfo();
    const maxConcurrency = gatewayInfo.session_start_limit.max_concurrency;

    for (
      let clusterId = 0;
      clusterId < this.currentDistribution.totalClusters;
      clusterId++
    ) {
      const shards =
        this.currentDistribution.clusterShards.get(clusterId) || [];

      try {
        await this.createCluster(clusterId, shards);

        // Wait between cluster starts
        if (clusterId < this.currentDistribution.totalClusters - 1) {
          logger.debug(
            `[ClusterManager] Waiting ${this.startupDelay}ms before starting next cluster`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.startupDelay)
          );
        }
      } catch (error) {
        logger.error(
          `[ClusterManager] Failed to start cluster ${clusterId}:`,
          error
        );
        throw error;
      }
    }
  }

  // Docker methods
  private async createDockerContainer(
    clusterId: number,
    shards: number[]
  ): Promise<string> {
    const containerName = `${CONTAINER_NAME_PREFIX}-${clusterId}`;

    // Check if a container with this name already exists
    try {
      const existingContainers = await this.docker!.listContainers({
        all: true,
        filters: {
          name: [containerName],
        },
      });

      if (existingContainers.length > 0) {
        logger.warn(
          `[ClusterManager] Container ${containerName} already exists, removing it...`
        );
        for (const containerInfo of existingContainers) {
          try {
            const existingContainer = this.docker!.getContainer(
              containerInfo.Id
            );

            // Try to stop it if it's running
            try {
              await existingContainer.stop({ t: 5 });
              logger.info(
                `[ClusterManager] Stopped existing container ${containerName}`
              );
            } catch (stopError: any) {
              // Container might already be stopped, ignore the error
              if (
                stopError.statusCode !== 304 &&
                stopError.statusCode !== 404
              ) {
                logger.warn(
                  `[ClusterManager] Could not stop container ${containerName}:`,
                  stopError.message
                );
              }
            }

            // Remove the container
            await existingContainer.remove({ force: true });
            logger.info(
              `[ClusterManager] Removed existing container ${containerName}`
            );
          } catch (removeError: any) {
            logger.warn(
              `[ClusterManager] Could not remove container ${containerName}:`,
              removeError.message
            );
            // If we can't remove it, we'll still try to create a new one which will fail with a clearer error
          }
        }
      }
    } catch (checkError: any) {
      logger.warn(
        `[ClusterManager] Error checking for existing containers:`,
        checkError.message
      );
      // Continue with creation attempt
    }

    logger.info(`[ClusterManager] Creating Docker container ${containerName} for cluster ${clusterId} with ${shards.length} shards`);
    logger.debug(`[ClusterManager] Container ${containerName} - shards: [${shards.join(", ")}], network: ${DOCKER_NETWORK_NAME}`);
    logger.debug(`[ClusterManager] API_BASE_URL for container: ${process.env.API_BASE_URL || "http://api:3000"}`);

    const env = [
      `CLUSTER_ID=${clusterId}`,
      `SHARD_LIST=${JSON.stringify(shards)}`,
      `TOTAL_SHARDS=${process.env.TOTAL_SHARDS!}`,
      `BOT_TOKEN=${process.env.BOT_TOKEN}`,
      `NODE_ENV=${process.env.NODE_ENV || "production"}`,
      `API_BASE_URL=${process.env.API_BASE_URL || "http://api:3000"}`,
      `NIRN_HOST=${process.env.NIRN_HOST || "nirn-proxy"}`,
      `NIRN_PORT=${process.env.NIRN_PORT || "8081"}`,
      `REDIS_HOST=${process.env.REDIS_HOST || "redis"}`,
      `REDIS_PORT=${process.env.REDIS_PORT || "6379"}`,
      `RABBITMQ_URL=${process.env.RABBITMQ_URL || "amqp://rabbitmq:5672"}`,
      `RABBITMQ_USERNAME=${process.env.RABBITMQ_USERNAME || "bot"}`,
      `RABBITMQ_PASSWORD=${process.env.RABBITMQ_PASSWORD || "bot_password"}`,
    ];

    const container = await this.docker!.createContainer({
      Image: this.imageName,
      name: containerName,
      Cmd: ["bun", "run", "src/index.ts"],
      Env: env,
      Labels: {
        "bot.cluster.id": clusterId.toString(),
        "bot.cluster.shards": shards.join(","),
        "bot.managed": "true",
        "com.docker.compose.project": DOCKER_PROJECT_PREFIX,
      },
      // Health monitoring via Docker container status + RabbitMQ events (no HTTP health check)
      HostConfig: {
        NetworkMode: DOCKER_NETWORK_NAME, // Connect to the same network as other services
      },
    });

    logger.debug(`[ClusterManager] Starting container ${containerName} (id: ${container.id})...`);
    await container.start();
    logger.info(
      `[ClusterManager] Created and started container ${container.id} (name: ${containerName}) for cluster ${clusterId}`
    );
    return container.id;
  }

  private async stopDockerContainer(containerId: string): Promise<void> {
    logger.debug(`[ClusterManager] Stopping Docker container ${containerId}...`);
    const container = this.docker!.getContainer(containerId);

    try {
      await container.stop({ t: 10 });
      logger.debug(`[ClusterManager] Container ${containerId} stopped, removing...`);
      await container.remove();
      logger.info(
        `[ClusterManager] Stopped and removed container ${containerId}`
      );
    } catch (error) {
      logger.error(
        `[ClusterManager] Error stopping container ${containerId}:`,
        error
      );
    }
  }

  private async createSwarmService(
    clusterId: number,
    shards: number[]
  ): Promise<string> {
    const serviceName = `${CONTAINER_NAME_PREFIX}-${clusterId}`;

    const env = [
      `CLUSTER_ID=${clusterId}`,
      `SHARD_LIST=${JSON.stringify(shards)}`,
      `TOTAL_SHARDS=${process.env.TOTAL_SHARDS!}`,
      `BOT_TOKEN=${process.env.BOT_TOKEN}`,
      `NODE_ENV=${process.env.NODE_ENV || "production"}`,
      `API_BASE_URL=${process.env.API_BASE_URL || "http://api:3000"}`,
      `NIRN_HOST=${process.env.NIRN_HOST || "nirn-proxy"}`,
      `NIRN_PORT=${process.env.NIRN_PORT || "8081"}`,
      `REDIS_HOST=${process.env.REDIS_HOST || "redis"}`,
      `REDIS_PORT=${process.env.REDIS_PORT || "6379"}`,
      `RABBITMQ_URL=${process.env.RABBITMQ_URL || "amqp://rabbitmq:5672"}`,
      `RABBITMQ_USERNAME=${process.env.RABBITMQ_USERNAME || "bot"}`,
      `RABBITMQ_PASSWORD=${process.env.RABBITMQ_PASSWORD || "bot_password"}`,
    ];

    const service = await this.docker!.createService({
      Name: serviceName,
      TaskTemplate: {
        ContainerSpec: {
          Image: this.imageName,
          Command: ["bun", "run", "src/index.ts"],
          Env: env,
          Labels: {
            "bot.cluster.id": clusterId.toString(),
            "bot.cluster.shards": shards.join(","),
            "bot.managed": "true",
          },
          // Health monitoring via Docker container status + RabbitMQ events (no HTTP health check)
        },
        Networks: [
          {
            Target: DOCKER_NETWORK_NAME,
          },
        ],
        RestartPolicy: {
          Condition: "on-failure",
          Delay: 5000000000,
          MaxAttempts: 3,
        },
        Resources: {
          Limits: {
            NanoCPUs: 500000000, // 0.5 CPU
            MemoryBytes: 536870912, // 512MB
          },
          Reservations: {
            NanoCPUs: 250000000, // 0.25 CPU
            MemoryBytes: 268435456, // 256MB
          },
        },
      },
      Mode: {
        Replicated: {
          Replicas: 1,
        },
      },
      UpdateConfig: {
        Parallelism: 1,
        Delay: 10000000000, // 10 seconds
        FailureAction: "rollback",
        Order: "start-first",
      },
      RollbackConfig: {
        Parallelism: 1,
        Delay: 5000000000, // 5 seconds
        Order: "stop-first",
      },
    });

    const serviceInfo = await this.docker!.getService(service.ID).inspect();
    logger.info(
      `[ClusterManager] Created swarm service ${service.ID} for cluster ${clusterId}`
    );
    return service.ID;
  }

  private async removeSwarmService(clusterId: number): Promise<void> {
    const serviceName = `${CONTAINER_NAME_PREFIX}-${clusterId}`;

    try {
      const services = await this.docker!.listServices({
        filters: { name: [serviceName] },
      });

      if (services.length > 0) {
        await this.docker!.getService(services[0].ID).remove();
        logger.info(
          `[ClusterManager] Removed swarm service for cluster ${clusterId}`
        );
      }
    } catch (error) {
      logger.error(
        `[ClusterManager] Error removing swarm service for cluster ${clusterId}:`,
        error
      );
    }
  }

  private async getDockerClusterStatus(
    clusterId: number,
    containerId: string
  ): Promise<ClusterStatus> {
    const cluster = this.clusters.get(clusterId)!;

    try {
      if (this.useSwarm) {
        logger.debug(`[ClusterManager] Getting swarm service status for cluster ${clusterId}`);
        return this.getSwarmServiceStatus(clusterId);
      } else {
        logger.debug(`[ClusterManager] Getting Docker container status for cluster ${clusterId} (containerId: ${containerId})`);
        const container = this.docker!.getContainer(containerId);
        const containerInfo = await container.inspect();

        // Use Docker container status for health checks (container running = ready)
        // Bot containers don't have HTTP health checks, so we check if container is running
        const isRunning = containerInfo.State.Running;
        cluster.status.isRunning = isRunning;
        
        // If container is running, consider it healthy and ready
        // Bot will send RabbitMQ events for metrics, but container status determines readiness
        const health = isRunning ? "healthy" : "unhealthy";
        cluster.status.health = health;
        cluster.status.isReady = isRunning;
        
        cluster.status.uptime = Date.now() - cluster.startTime.getTime();
        
        logger.debug(
          `[ClusterManager] Cluster ${clusterId} status - running: ${isRunning}, ready: ${cluster.status.isReady}, health: ${health}, uptime: ${cluster.status.uptime}ms`
        );
        
        return cluster.status;
      }
    } catch (error) {
      logger.error(
        `[ClusterManager] Error getting Docker status for cluster ${clusterId} (containerId: ${containerId}):`,
        error
      );
      cluster.status.health = "unhealthy";
      cluster.status.isRunning = false;
      cluster.status.isReady = false;
    }

    return cluster.status;
  }

  private async getSwarmServiceStatus(
    clusterId: number
  ): Promise<ClusterStatus> {
    const cluster = this.clusters.get(clusterId)!;
    const serviceName = `${CONTAINER_NAME_PREFIX}-${clusterId}`;

    try {
      const services = await this.docker!.listServices({
        filters: { name: [serviceName] },
      });

      if (services.length === 0) {
        cluster.status.isRunning = false;
        cluster.status.isReady = false;
        cluster.status.health = "unhealthy";
        return cluster.status;
      }

      const service = services[0];
      const tasks = await this.docker!.listTasks({
        filters: { service: [service.ID] },
      });

      const runningTasks = tasks.filter(
        (task) => task.Status.State === "running"
      );
      const isRunning = runningTasks.length > 0;
      const isReady =
        isRunning &&
        runningTasks.some((task) => task.Status.State === "running");

      cluster.status.isRunning = isRunning;
      cluster.status.isReady = isReady;
      cluster.status.health = isRunning ? "healthy" : "unhealthy";
      cluster.status.uptime = isRunning
        ? Date.now() - new Date(service.CreatedAt || Date.now()).getTime()
        : 0;
    } catch (error) {
      logger.error(
        `[ClusterManager] Error getting swarm service status for cluster ${clusterId}:`,
        error
      );
      cluster.status.isRunning = false;
      cluster.status.isReady = false;
      cluster.status.health = "unhealthy";
    }

    return cluster.status;
  }

  // Detection methods
  private async detectDockerAvailability(): Promise<boolean> {
    try {
      // Check if Docker socket exists
      const fs = require("fs");
      const socketPath =
        process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";

      if (!fs.existsSync(socketPath)) {
        logger.warn(
          `[ClusterManager] Docker socket not found at ${socketPath}`
        );
        return false;
      }

      // Test Docker connection
      const testDocker = new Docker({
        socketPath: socketPath,
      });

      await testDocker.ping();
      logger.info("[ClusterManager] Docker connection successful");
      return true;
    } catch (error) {
      logger.warn("[ClusterManager] Docker not available:", error);
      return false;
    }
  }

  private async detectSwarmAvailability(): Promise<boolean> {
    try {
      if (process.env.DOCKER_SWARM_MODE === "false") {
        logger.info("[ClusterManager] Docker Swarm explicitly disabled");
        return false;
      }

      // Test if we can access Docker Swarm
      const testDocker = new Docker({
        socketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
      });

      const info = await testDocker.info();
      const isSwarmMode = info.Swarm && info.Swarm.LocalNodeState === "active";

      if (isSwarmMode) {
        logger.info("[ClusterManager] Docker Swarm is active and available");
        return true;
      } else {
        logger.info(
          "[ClusterManager] Docker Swarm not active, using regular Docker"
        );
        return false;
      }
    } catch (error) {
      logger.warn("[ClusterManager] Error detecting Docker Swarm:", error);
      return false;
    }
  }

  // RabbitMQ and metrics setup
  private async setupRabbitMQHandlers(): Promise<void> {
    logger.info("[ClusterManager] Setting up RabbitMQ handlers...");
    
    await this.rabbitMQ.consumeTasks("cluster.start", async (task) => {
      try {
        const { clusterId, type } = task.data;
        logger.debug(`[ClusterManager] Received cluster.start task ${task.id} for cluster ${clusterId}, type: ${type}`);

        if (type === CLUSTER_EVENTS.START) {
          logger.info(
            `[ClusterManager] Cluster ${clusterId} started and reported ready via RabbitMQ`
          );
          // Update cluster status to ready
          const cluster = this.clusters.get(clusterId);
          if (cluster) {
            const wasReady = cluster.status.isReady;
            cluster.status.isReady = true;
            cluster.status.health = "healthy";
            cluster.lastHealthCheck = new Date();
            
            if (!wasReady) {
              logger.info(`[ClusterManager] Cluster ${clusterId} status updated: isReady=true, health=healthy`);
            } else {
              logger.debug(`[ClusterManager] Cluster ${clusterId} already marked as ready (RabbitMQ event received)`);
            }
          } else {
            logger.warn(`[ClusterManager] Received cluster.start event for unknown cluster ${clusterId}`);
          }
        } else {
          logger.debug(`[ClusterManager] Received cluster.start task with unexpected type: ${type}`);
        }
      } catch (error) {
        logger.error(
          `[ClusterManager] Error processing cluster start task ${task.id}:`,
          error
        );
      }
    });
    
    logger.debug("[ClusterManager] RabbitMQ handler for cluster.start registered");

    await this.rabbitMQ.consumeTasks("cluster.stop", async (task) => {
      try {
        const { clusterId, type } = task.data;
        logger.debug(`[ClusterManager] Received cluster.stop task ${task.id} for cluster ${clusterId}, type: ${type}`);

        if (type === CLUSTER_EVENTS.STOP) {
          logger.info(
            `[ClusterManager] Cluster ${clusterId} stopped and reported shutdown via RabbitMQ`
          );
          // Update cluster status to stopped
          const cluster = this.clusters.get(clusterId);
          if (cluster) {
            cluster.status.isRunning = false;
            cluster.status.isReady = false;
            cluster.status.health = "unhealthy";
            cluster.lastHealthCheck = new Date();
            logger.debug(`[ClusterManager] Cluster ${clusterId} status updated: isRunning=false, isReady=false, health=unhealthy`);
          } else {
            logger.warn(`[ClusterManager] Received cluster.stop event for unknown cluster ${clusterId}`);
          }
        }
      } catch (error) {
        logger.error(
          `[ClusterManager] Error processing cluster stop task ${task.id}:`,
          error
        );
      }
    });
    
    logger.debug("[ClusterManager] RabbitMQ handler for cluster.stop registered");

    await this.rabbitMQ.consumeTasks("metrics.cluster", async (task) => {
      try {
        const { clusterId, metrics } = task.data;
        this.clusterMetrics.set(clusterId, metrics);
        logger.debug(
          `[ClusterManager] Received metrics from cluster ${clusterId} (task ${task.id}, metrics length: ${metrics?.length || 0} chars)`
        );
      } catch (error) {
        logger.error(
          `[ClusterManager] Error processing metrics task ${task.id}:`,
          error
        );
      }
    });
    
    logger.debug("[ClusterManager] RabbitMQ handler for metrics.cluster registered");
    logger.info("[ClusterManager] All RabbitMQ handlers set up successfully");
  }

  private async setupMetricsServer(): Promise<any> {
    const port = parseInt(process.env.METRICS_PORT || "3001");

    const app = new Elysia()
      .get("/metrics", async ({ set }) => {
        try {
          const { register } = await import("./utils/metrics");
          let aggregatedMetrics = await register.metrics();

          // Add cluster manager metrics
          aggregatedMetrics += "\n# Cluster manager metrics\n";
          aggregatedMetrics += `cluster_manager_clusters_total{status="running"} ${this.clusters.size}\n`;

          for (const [clusterId, metrics] of this.clusterMetrics) {
            try {
              const lines = metrics.split("\n");
              for (const line of lines) {
                if (line.startsWith("#") || line.trim() === "") continue;

                const metricName = line.split(/[{\s]/)[0];
                if (metricName.startsWith("bot_")) {
                  let processedLine = line;
                  if (
                    metricName.startsWith("bot_cluster_") &&
                    !line.includes("cluster_id=")
                  ) {
                    const spaceIndex = line.indexOf(" ");
                    if (spaceIndex > 0) {
                      const metric = line.substring(0, spaceIndex);
                      const value = line.substring(spaceIndex);

                      if (metric.includes("{")) {
                        processedLine =
                          metric.replace("}", `,cluster_id="${clusterId}"}`) +
                          value;
                      } else {
                        processedLine = `${metric}{cluster_id="${clusterId}"}${value}`;
                      }
                    }
                  }
                  aggregatedMetrics += "\n" + processedLine;
                }
              }
            } catch (error) {
              logger.warn(
                `[ClusterManager] Failed to process metrics from cluster ${clusterId}:`,
                error
              );
            }
          }

          set.headers["Content-Type"] = register.contentType;
          return aggregatedMetrics;
        } catch (error) {
          logger.error("[ClusterManager] Error serving metrics:", error);
          set.status = 500;
          return String(error);
        }
      })
      .listen(port);

    // Log server startup - listen() starts the server synchronously
    logger.info(`[ClusterManager] Metrics server listening on port ${port}`);

    return app;
  }

  /**
   * Clean up orphaned containers from previous runs
   */
  private async cleanupOrphanedContainers(): Promise<void> {
    try {
      logger.info("[ClusterManager] Cleaning up orphaned containers...");

      // Find all containers with the bot.managed label
      const allContainers = await this.docker!.listContainers({
        all: true,
        filters: {
          label: ["bot.managed=true"],
        },
      });

      for (const containerInfo of allContainers) {
        try {
          const container = this.docker!.getContainer(containerInfo.Id);
          const containerName =
            containerInfo.Names?.[0]?.replace(/^\//, "") || containerInfo.Id;

          // Check if container name matches our pattern
          if (containerName.startsWith(`${CONTAINER_NAME_PREFIX}-`)) {
            logger.info(
              `[ClusterManager] Removing orphaned container: ${containerName}`
            );

            // Try to stop if running
            try {
              await container.stop({ t: 5 });
            } catch (stopError: any) {
              // Container might already be stopped
              if (
                stopError.statusCode !== 304 &&
                stopError.statusCode !== 404
              ) {
                logger.debug(
                  `[ClusterManager] Could not stop ${containerName}:`,
                  stopError.message
                );
              }
            }

            // Remove the container
            await container.remove({ force: true });
            logger.info(
              `[ClusterManager] Removed orphaned container: ${containerName}`
            );
          }
        } catch (error: any) {
          logger.warn(
            `[ClusterManager] Error removing orphaned container:`,
            error.message
          );
        }
      }

      logger.info("[ClusterManager] Cleanup completed");
    } catch (error: any) {
      logger.warn("[ClusterManager] Error during cleanup:", error.message);
      // Don't fail startup if cleanup fails
    }
  }

  // Utility methods
  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Get current cluster status
   */
  async getClusterStatus(): Promise<any> {
    const clusters = await this.listClusters();
    return {
      totalClusters: clusters.length,
      clusters: clusters.map((c) => ({
        id: c.id,
        shards: c.shards,
        status: c.status,
        runtime: c.runtime,
      })),
      distribution: this.currentDistribution,
      isRunning: this.isRunning,
      runtime: {
        useSwarm: this.useSwarm,
      },
    };
  }
}

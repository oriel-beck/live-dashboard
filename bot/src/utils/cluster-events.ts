import {
  RabbitMQService,
  QUEUE_NAMES,
  CLUSTER_EVENTS,
  ClusterStartEventData,
  ClusterStopEventData,
  BotClusterConfig,
  logger,
} from "@discord-bot/shared-types";

/**
 * Send cluster start event to manager via RabbitMQ
 */
export async function sendClusterStartEvent(
  rabbitMQ: RabbitMQService,
  config: BotClusterConfig
): Promise<void> {
  try {
    const eventData: ClusterStartEventData = {
      clusterId: config.clusterId,
      shardList: config.shardList,
      timestamp: new Date().toISOString(),
    };

    await rabbitMQ.publishTask(QUEUE_NAMES.CLUSTER_START, {
      id: `start-${config.clusterId}-${Date.now()}`,
      type: CLUSTER_EVENTS.START,
      data: eventData,
      timestamp: new Date(),
    });

    logger.info(
      `[Cluster ${config.clusterId}] Sent cluster start event to manager via RabbitMQ`
    );
  } catch (error) {
    logger.warn(
      `[Cluster ${config.clusterId}] Failed to send cluster start event:`,
      error
    );
  }
}

/**
 * Send cluster stop event to manager via RabbitMQ
 */
export async function sendClusterStopEvent(
  rabbitMQ: RabbitMQService,
  config: BotClusterConfig
): Promise<void> {
  try {
    const eventData: ClusterStopEventData = {
      clusterId: config.clusterId,
      shardList: config.shardList,
      timestamp: new Date().toISOString(),
      reason: "process_termination",
    };

    await rabbitMQ.publishTask(QUEUE_NAMES.CLUSTER_STOP, {
      id: `stop-${config.clusterId}-${Date.now()}`,
      type: CLUSTER_EVENTS.STOP,
      data: eventData,
      timestamp: new Date(),
    });

    logger.info(
      `[Cluster ${config.clusterId}] Sent cluster stop event to manager via RabbitMQ`
    );
  } catch (error) {
    logger.warn(
      `[Cluster ${config.clusterId}] Failed to send cluster stop event:`,
      error
    );
  }
}

/**
 * Initialize RabbitMQ connection
 */
export async function initializeRabbitMQ(
  rabbitMQ: RabbitMQService,
  clusterId: number
): Promise<void> {
  try {
    await rabbitMQ.connect();
    await rabbitMQ.initializeDefaults();
    logger.info(`[Cluster ${clusterId}] RabbitMQ connection established`);
  } catch (error) {
    logger.warn(`[Cluster ${clusterId}] Failed to connect to RabbitMQ:`, error);
  }
}

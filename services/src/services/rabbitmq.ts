import * as amqp from "amqplib";
import { logger } from "./logger";
import { EXCHANGE_NAMES, ExchangeConfig, Message, MessageHandler, QUEUE_NAMES, QueueConfig, RabbitMQConfig, Task, TaskHandler } from "@discord-bot/shared";

export class RabbitMQService {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private config: RabbitMQConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private taskHandlers = new Map<string, TaskHandler>();
  private messageHandlers = new Map<string, MessageHandler>();

  constructor(config?: Partial<RabbitMQConfig>) {
    this.config = {
      url: process.env.RABBITMQ_URL || "amqp://localhost:5672",
      username: process.env.RABBITMQ_USERNAME,
      password: process.env.RABBITMQ_PASSWORD,
      heartbeat: 60,
      connectionTimeout: 30000,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };

    this.maxReconnectAttempts = this.config.maxReconnectAttempts!;
    this.reconnectDelay = this.config.reconnectDelay!;
  }

  /**
   * Connect to RabbitMQ server
   */
  async connect(): Promise<void> {
    try {
      // Build connection URL with credentials if provided
      // Embedding credentials in URL is more reliable than passing as options
      let connectionUrl = this.config.url;

      // Parse the URL to extract host/port
      let urlObj: URL;
      try {
        urlObj = new URL(connectionUrl);
      } catch (error) {
        // If URL parsing fails, construct a new one
        const hostPort = connectionUrl.replace(/^amqp:\/\//, "").split("/")[0];
        urlObj = new URL(`amqp://${hostPort}`);
      }

      // Set credentials if provided
      if (this.config.username && this.config.password) {
        urlObj.username = this.config.username;
        urlObj.password = this.config.password;
        connectionUrl = urlObj.toString();
      }

      logger.info("[RabbitMQService] Connecting to RabbitMQ...", {
        url: connectionUrl.replace(/:[^:@]*@/, ":****@"), // Hide password in logs
        host: urlObj.hostname,
        port: urlObj.port || "5672",
        username: this.config.username || "not set",
      });

      if (!this.config.username || !this.config.password) {
        logger.warn(
          "[RabbitMQService] No username/password provided - using default or URL credentials"
        );
      }

      const connectionOptions: amqp.Options.Connect = {
        heartbeat: this.config.heartbeat,
      };

      this.connection = await amqp.connect(connectionUrl, connectionOptions);
      this.channel = await this.connection.createChannel();

      // Set up connection event handlers
      this.connection.on("error", (error: Error) => {
        logger.error("[RabbitMQService] Connection error:", error);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection.on("close", () => {
        logger.warn("[RabbitMQService] Connection closed");
        this.isConnected = false;
        this.handleReconnect();
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info("[RabbitMQService] Connected to RabbitMQ successfully");
    } catch (error) {
      logger.error("[RabbitMQService] Failed to connect to RabbitMQ:", error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from RabbitMQ server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isConnected = false;
      logger.info("[RabbitMQService] Disconnected from RabbitMQ");
    } catch (error) {
      logger.error(
        "[RabbitMQService] Error disconnecting from RabbitMQ:",
        error
      );
    }
  }

  /**
   * Publish a task to a queue
   */
  async publishTask(queueName: string, task: Task): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      await this.channel.assertQueue(queueName, { durable: true });

      const message = Buffer.from(
        JSON.stringify({
          ...task,
          timestamp: task.timestamp.toISOString(),
        })
      );

      const published = this.channel.sendToQueue(queueName, message, {
        persistent: true,
        messageId: task.id,
        timestamp: task.timestamp.getTime(),
      });

      if (!published) {
        throw new Error("Failed to publish task to queue");
      }

      logger.debug(
        `[RabbitMQService] Published task ${task.id} to queue ${queueName}`
      );
    } catch (error) {
      logger.error(
        `[RabbitMQService] Failed to publish task to queue ${queueName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Consume tasks from a queue
   */
  async consumeTasks(queueName: string, handler: TaskHandler): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      await this.channel.assertQueue(queueName, { durable: true });

      // Store handler for reconnection
      this.taskHandlers.set(queueName, handler);

      await this.channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const taskData = JSON.parse(msg.content.toString());
            const task: Task = {
              ...taskData,
              timestamp: new Date(taskData.timestamp),
            };

            await handler(task);

            // Acknowledge the message
            this.channel!.ack(msg);

            logger.debug(
              `[RabbitMQService] Processed task ${task.id} from queue ${queueName}`
            );
          } catch (error) {
            logger.error(
              `[RabbitMQService] Error processing task from queue ${queueName}:`,
              error
            );

            // Reject and requeue the message
            this.channel!.nack(msg, false, true);
          }
        },
        { noAck: false }
      );

      logger.info(
        `[RabbitMQService] Started consuming tasks from queue ${queueName}`
      );
    } catch (error) {
      logger.error(
        `[RabbitMQService] Failed to consume tasks from queue ${queueName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Publish a message to an exchange
   */
  async publishMessage(
    exchangeName: string,
    message: Message,
    routingKey?: string
  ): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      await this.channel.assertExchange(exchangeName, "topic", {
        durable: true,
      });

      const messageBuffer = Buffer.from(
        JSON.stringify({
          ...message,
          timestamp: message.timestamp.toISOString(),
        })
      );

      const published = this.channel.publish(
        exchangeName,
        routingKey || "",
        messageBuffer,
        {
          persistent: true,
          messageId: message.id,
          timestamp: message.timestamp.getTime(),
        }
      );

      if (!published) {
        throw new Error("Failed to publish message to exchange");
      }

      logger.debug(
        `[RabbitMQService] Published message ${message.id} to exchange ${exchangeName}`
      );
    } catch (error) {
      logger.error(
        `[RabbitMQService] Failed to publish message to exchange ${exchangeName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Subscribe to messages from an exchange
   */
  async subscribeToMessages(
    exchangeName: string,
    handler: MessageHandler,
    routingKey?: string
  ): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      await this.channel.assertExchange(exchangeName, "topic", {
        durable: true,
      });

      // Create a temporary queue for this subscription
      const queueResult = await this.channel.assertQueue("", {
        exclusive: true,
      });
      const queueName = queueResult.queue;

      // Bind the queue to the exchange
      await this.channel.bindQueue(queueName, exchangeName, routingKey || "#");

      // Store handler for reconnection
      this.messageHandlers.set(`${exchangeName}:${routingKey || "#"}`, handler);

      await this.channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const messageData = JSON.parse(msg.content.toString());
            const message: Message = {
              ...messageData,
              timestamp: new Date(messageData.timestamp),
            };

            await handler(message);

            // Acknowledge the message
            this.channel!.ack(msg);

            logger.debug(
              `[RabbitMQService] Processed message ${message.id} from exchange ${exchangeName}`
            );
          } catch (error) {
            logger.error(
              `[RabbitMQService] Error processing message from exchange ${exchangeName}:`,
              error
            );

            // Reject and requeue the message
            this.channel!.nack(msg, false, true);
          }
        },
        { noAck: false }
      );

      logger.info(
        `[RabbitMQService] Subscribed to messages from exchange ${exchangeName} with routing key ${
          routingKey || "#"
        }`
      );
    } catch (error) {
      logger.error(
        `[RabbitMQService] Failed to subscribe to messages from exchange ${exchangeName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a queue with configuration
   */
  async createQueue(config: QueueConfig): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      await this.channel.assertQueue(config.name, {
        durable: config.durable,
        exclusive: config.exclusive,
        autoDelete: config.autoDelete,
        arguments: config.arguments,
      });

      logger.info(`[RabbitMQService] Created queue ${config.name}`);
    } catch (error) {
      logger.error(
        `[RabbitMQService] Failed to create queue ${config.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create an exchange with configuration
   */
  async createExchange(config: ExchangeConfig): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      await this.channel.assertExchange(config.name, config.type, {
        durable: config.durable,
        autoDelete: config.autoDelete,
        arguments: config.arguments,
      });

      logger.info(
        `[RabbitMQService] Created exchange ${config.name} of type ${config.type}`
      );
    } catch (error) {
      logger.error(
        `[RabbitMQService] Failed to create exchange ${config.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isConnectionHealthy(): boolean {
    return (
      this.isConnected && this.connection !== null && this.channel !== null
    );
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        "[RabbitMQService] Max reconnection attempts reached, giving up"
      );
      return;
    }

    this.reconnectAttempts++;
    logger.info(
      `[RabbitMQService] Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(async () => {
      try {
        await this.connect();
        await this.reestablishConsumers();
        logger.info("[RabbitMQService] Reconnected successfully");
      } catch (error) {
        logger.error("[RabbitMQService] Reconnection failed:", error);
        this.handleReconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Reestablish all consumers after reconnection
   */
  private async reestablishConsumers(): Promise<void> {
    // Reestablish task consumers
    for (const [queueName, handler] of this.taskHandlers) {
      try {
        await this.consumeTasks(queueName, handler);
      } catch (error) {
        logger.error(
          `[RabbitMQService] Failed to reestablish consumer for queue ${queueName}:`,
          error
        );
      }
    }

    // Reestablish message consumers
    for (const [key, handler] of this.messageHandlers) {
      try {
        const [exchangeName, routingKey] = key.split(":");
        await this.subscribeToMessages(
          exchangeName,
          handler,
          routingKey === "#" ? undefined : routingKey
        );
      } catch (error) {
        logger.error(
          `[RabbitMQService] Failed to reestablish consumer for exchange ${key}:`,
          error
        );
      }
    }
  }

  /**
   * Initialize default queues and exchanges
   */
  async initializeDefaults(): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error("RabbitMQ not connected");
    }

    try {
      // Create default exchanges
      const exchanges = Object.values(EXCHANGE_NAMES);
      for (const exchangeName of exchanges) {
        await this.createExchange({
          name: exchangeName,
          type: "topic",
          durable: true,
          autoDelete: false,
        });
      }

      // Create default queues
      const queues = Object.values(QUEUE_NAMES);
      for (const queueName of queues) {
        await this.createQueue({
          name: queueName,
          durable: true,
          exclusive: false,
          autoDelete: false,
        });
      }

      logger.info("[RabbitMQService] Initialized default queues and exchanges");
    } catch (error) {
      logger.error("[RabbitMQService] Failed to initialize defaults:", error);
      throw error;
    }
  }
}

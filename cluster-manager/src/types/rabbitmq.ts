export interface Task {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  retries?: number;
  maxRetries?: number;
}

export interface Message {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
  target?: string;
}

export interface TaskHandler {
  (task: Task): Promise<void>;
}

export interface MessageHandler {
  (message: Message): Promise<void>;
}

export interface QueueConfig {
  name: string;
  durable: boolean;
  exclusive: boolean;
  autoDelete: boolean;
  arguments?: any;
}

export interface ExchangeConfig {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  durable: boolean;
  autoDelete: boolean;
  arguments?: any;
}

export interface RabbitMQConfig {
  url: string;
  username?: string;
  password?: string;
  heartbeat?: number;
  connectionTimeout?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

// Predefined queue names
export const QUEUE_NAMES = {
  CLUSTER_START: 'cluster.start',
  CLUSTER_STOP: 'cluster.stop',
} as const;

// Predefined exchange names
export const EXCHANGE_NAMES = {
  CLUSTER_EVENTS: 'cluster.events',
} as const;

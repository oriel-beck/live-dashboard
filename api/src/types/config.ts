// Config types
export interface Config {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  discord: {
    clientId: string;
    clientSecret: string;
    botToken: string;
    redirectUri: string;
    apiUrl: string;
  };
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
}

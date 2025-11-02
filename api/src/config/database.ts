import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from './index';
import { CommandCategory } from '../entities/CommandCategory';
import { DefaultCommand } from '../entities/DefaultCommand';

// Determine SSL mode: only use SSL when explicitly enabled via POSTGRES_SSL env var
// PostgreSQL in Docker Compose typically doesn't have SSL enabled by default
// Only enable SSL for remote/production databases that require it
const useSsl = process.env.POSTGRES_SSL === 'true';

// Build connection URL with explicit sslmode parameter to ensure SSL is properly disabled
// TypeORM's ssl property doesn't always work reliably, so we use connection string parameters
const buildConnectionUrl = (): string => {
  const protocol = 'postgresql';
  const username = encodeURIComponent(config.database.user);
  const password = encodeURIComponent(config.database.password);
  const host = config.database.host;
  const port = config.database.port;
  const database = config.database.database;
  
  // Append sslmode parameter: 'disable' when SSL is off, 'require' when SSL is on
  // Using lowercase 'disable' as PostgreSQL connection strings are case-sensitive for parameters
  const sslmode = useSsl ? 'require' : 'disable';
  
  const connectionUrl = `${protocol}://${username}:${password}@${host}:${port}/${database}?sslmode=${sslmode}`;
  
  // Log the connection URL (with password masked) for debugging
  const maskedUrl = connectionUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`[Database Config] Connection URL: ${maskedUrl}`);
  
  return connectionUrl;
};

const dataSourceConfig: DataSourceOptions = {
  type: 'postgres',
  // Use connection URL with explicit sslmode to control SSL behavior
  // The URL parameter takes precedence over individual connection parameters
  url: buildConnectionUrl(),
  synchronize: true, // We'll use migrations
  logging: config.nodeEnv === 'development',
  entities: [CommandCategory, DefaultCommand],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscriber/*.ts'],
  // When using url with sslmode parameter, we can omit the ssl property
  // The sslmode in the URL will control SSL behavior
};

export const AppDataSource = new DataSource(dataSourceConfig);

export default AppDataSource;

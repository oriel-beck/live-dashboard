import { DataSource } from 'typeorm';
import { config } from './index';
import { CommandCategory } from '../entities/CommandCategory';
import { DefaultCommand } from '../entities/DefaultCommand';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.user,
  password: config.database.password,
  database: config.database.database,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  synchronize: false, // We'll use migrations
  logging: config.nodeEnv === 'development',
  entities: [CommandCategory, DefaultCommand],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscriber/*.ts'],
});

export default AppDataSource;

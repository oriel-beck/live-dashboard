import { DataSource } from 'typeorm';
import { CommandCategory } from './src/entities/CommandCategory';
import { DefaultCommand } from './src/entities/DefaultCommand';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password1234',
  database: process.env.DB_NAME || 'public',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [CommandCategory, DefaultCommand],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscriber/*.ts'],
});

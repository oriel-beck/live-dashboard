// @ts-expect-error Add BigInt JSON serialization support
BigInt.prototype.toJSON = function() {
  return this.toString();
};

// Import reflect-metadata for TypeORM decorators
import 'reflect-metadata';

import { validateConfig } from './config';
import { startServer } from './app';

// Validate configuration
validateConfig();

// Start the server
startServer();
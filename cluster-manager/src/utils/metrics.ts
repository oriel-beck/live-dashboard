import { register, collectDefaultMetrics } from 'prom-client';

// Enable default metrics collection
collectDefaultMetrics({
  register,
  prefix: 'cluster_manager_',
});

// Export the register for use in metrics endpoint
export { register };


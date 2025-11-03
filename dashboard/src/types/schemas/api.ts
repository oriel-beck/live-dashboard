// Export types (manually defined since we only need the types, not the schemas)
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};


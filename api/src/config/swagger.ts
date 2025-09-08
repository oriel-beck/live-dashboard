import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Discord Bot Management Platform API',
      version: '1.0.0',
      description: 'A comprehensive API for managing Discord bots, commands, and guild configurations',
      contact: {
        name: 'API Support',
        email: 'support@discordbotplatform.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: config.nodeEnv === 'production' 
          ? 'https://api.discordbotplatform.com' 
          : `http://localhost:${config.port}`,
        description: config.nodeEnv === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        DiscordOAuth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://discord.com/api/oauth2/authorize',
              tokenUrl: 'https://discord.com/api/oauth2/token',
              scopes: {
                identify: 'Access to user identity information',
                guilds: 'Access to user guild information',
                'guilds.members.read': 'Read guild member information',
              },
            },
          },
        },
        SessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie for authenticated requests',
        },
        ApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for bot-to-API communication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR',
            },
            requestId: {
              type: 'string',
              example: 'req_1234567890_abc123',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
        Guild: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123456789012345678',
              description: 'Discord guild ID',
            },
            name: {
              type: 'string',
              example: 'My Discord Server',
              description: 'Guild name',
            },
            icon: {
              type: 'string',
              nullable: true,
              example: 'a_1234567890abcdef',
              description: 'Guild icon hash',
            },
            owner: {
              type: 'boolean',
              example: false,
              description: 'Whether the user owns this guild',
            },
            lastUpdated: {
              type: 'integer',
              example: 1640995200000,
              description: 'Last update timestamp',
            },
          },
        },
        GuildRole: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123456789012345678',
              description: 'Role ID',
            },
            name: {
              type: 'string',
              example: 'Admin',
              description: 'Role name',
            },
            position: {
              type: 'integer',
              example: 1,
              description: 'Role position',
            },
            color: {
              type: 'integer',
              example: 16711680,
              description: 'Role color (decimal)',
            },
            permissions: {
              type: 'string',
              example: '8',
              description: 'Role permissions (bitfield)',
            },
            managed: {
              type: 'boolean',
              example: false,
              description: 'Whether the role is managed by an integration',
            },
            lastUpdated: {
              type: 'integer',
              example: 1640995200000,
              description: 'Last update timestamp',
            },
          },
        },
        GuildChannel: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123456789012345678',
              description: 'Channel ID',
            },
            name: {
              type: 'string',
              example: 'general',
              description: 'Channel name',
            },
            type: {
              type: 'integer',
              example: 0,
              description: 'Channel type (0=text, 2=voice, 5=announcement)',
            },
            parentId: {
              type: 'string',
              nullable: true,
              example: '123456789012345678',
              description: 'Parent category ID',
            },
            position: {
              type: 'integer',
              example: 0,
              description: 'Channel position',
            },
            lastUpdated: {
              type: 'integer',
              example: 1640995200000,
              description: 'Last update timestamp',
            },
          },
        },
        Command: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
              description: 'Command ID',
            },
            name: {
              type: 'string',
              example: 'ping',
              description: 'Command name',
            },
            description: {
              type: 'string',
              example: 'Pong!',
              description: 'Command description',
            },
            cooldown: {
              type: 'integer',
              example: 5,
              description: 'Command cooldown in seconds',
            },
            enabled: {
              type: 'boolean',
              example: true,
              description: 'Whether the command is enabled',
            },
            categoryId: {
              type: 'string',
              nullable: true,
              example: '123e4567-e89b-12d3-a456-426614174000',
              description: 'Category ID',
            },
          },
        },
        CommandPermission: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123456789012345678',
              description: 'Permission ID',
            },
            type: {
              type: 'integer',
              example: 1,
              description: 'Permission type (1=role, 2=user)',
            },
            permission: {
              type: 'boolean',
              example: true,
              description: 'Whether the permission is granted',
            },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              example: 'healthy',
              description: 'Overall health status',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
              description: 'Health check timestamp',
            },
            uptime: {
              type: 'number',
              example: 3600.5,
              description: 'Server uptime in seconds',
            },
            environment: {
              type: 'string',
              example: 'production',
              description: 'Environment name',
            },
            version: {
              type: 'string',
              example: '1.0.0',
              description: 'API version',
            },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'string',
                  enum: ['connected', 'disconnected'],
                  example: 'connected',
                },
                redis: {
                  type: 'string',
                  enum: ['connected', 'disconnected'],
                  example: 'connected',
                },
                redisPubSub: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['healthy', 'degraded', 'unhealthy'],
                    },
                    connections: {
                      type: 'object',
                      properties: {
                        main: {
                          type: 'string',
                          enum: ['connected', 'disconnected'],
                        },
                        publisher: {
                          type: 'string',
                          enum: ['connected', 'disconnected'],
                        },
                        subscriber: {
                          type: 'string',
                          enum: ['connected', 'disconnected'],
                        },
                      },
                    },
                    metrics: {
                      type: 'object',
                      properties: {
                        activeConnections: {
                          type: 'integer',
                          example: 5,
                        },
                        messagesPublished: {
                          type: 'integer',
                          example: 1000,
                        },
                        messagesDelivered: {
                          type: 'integer',
                          example: 950,
                        },
                        connectionErrors: {
                          type: 'integer',
                          example: 2,
                        },
                        subscriptionErrors: {
                          type: 'integer',
                          example: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Too Many Requests',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        SessionAuth: [],
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Authentication',
        description: 'Discord OAuth2 authentication',
      },
      {
        name: 'Guilds',
        description: 'Guild management and information',
      },
      {
        name: 'Commands',
        description: 'Command configuration and permissions',
      },
      {
        name: 'Real-time',
        description: 'Server-Sent Events for real-time updates',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/app.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

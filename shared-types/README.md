# Shared Types Library

This package contains centralized Zod schemas and TypeScript types for the Discord Bot Management Platform.

## Features

- **Zod Schemas**: Runtime validation for all data structures
- **TypeScript Types**: Auto-generated types from Zod schemas
- **Centralized**: Single source of truth for all types across the project
- **Type Safety**: Ensures consistency between API, Bot, and Dashboard

## Installation

```bash
npm install @discord-bot/shared-types
```

## Usage

### Importing Types

```typescript
import { User, GuildCommandConfig, ApiResponse } from '@discord-bot/shared-types';
```

### Importing Schemas

```typescript
import { UserSchema, GuildCommandConfigSchema, ApiResponseSchema } from '@discord-bot/shared-types';
```

### Runtime Validation

```typescript
import { UserSchema } from '@discord-bot/shared-types';

// Validate incoming data
const userData = { id: '123', username: 'test' };
const validatedUser = UserSchema.parse(userData);

// Safe parsing with error handling
const result = UserSchema.safeParse(userData);
if (result.success) {
  const user = result.data;
} else {
  console.error('Validation failed:', result.error);
}
```

## Available Schemas

### User Schemas
- `UserSchema` - Discord user information
- `UserGuildSchema` - User's guild membership
- `SessionDataSchema` - Session information
- `AuthStateSchema` - Authentication state

### Guild Schemas
- `GuildRoleSchema` - Guild role information
- `GuildChannelSchema` - Guild channel information
- `GuildInfoSchema` - Basic guild information
- `CachedGuildRoleSchema` - Cached role data
- `CachedGuildChannelSchema` - Cached channel data
- `CachedGuildInfoSchema` - Cached guild data

### Command Schemas
- `CommandPermissionsSchema` - Command permission settings
- `GuildCommandConfigSchema` - Guild-specific command configuration
- `CommandConfigDataSchema` - Command configuration data
- `CommandConfigUpdateSchema` - Command configuration updates
- `SubcommandConfigSchema` - Subcommand configuration
- `DefaultCommandRegistrationSchema` - Default command registration

### API Schemas
- `ApiResponseSchema` - Standard API response format
- `GuildDataResponseSchema` - Guild data response
- `MessageSendRequestSchema` - Message sending request
- `MessageSendResponseSchema` - Message sending response
- `HealthCheckResponseSchema` - Health check response

### Database Schemas
- `DbDefaultCommandSchema` - Database default command
- `DbCommandConfigSchema` - Database command configuration
- `CommandConfigResultSchema` - Command configuration result
- `CommandConfigWithSubcommandResultSchema` - Command config with subcommand

## Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Clean

```bash
npm run clean
```

## Integration

This package is used by:
- **API Service**: For request/response validation and type safety
- **Bot Service**: For command configuration and data validation
- **Dashboard**: For type-safe API communication and data handling

## Best Practices

1. **Always validate incoming data** using the appropriate schema
2. **Use the exported types** instead of defining your own
3. **Update schemas** when adding new fields or changing data structures
4. **Test validation** with various data scenarios
5. **Handle validation errors** gracefully in your applications

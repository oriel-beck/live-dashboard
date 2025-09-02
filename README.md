# Discord Bot Management Platform

A comprehensive Discord bot management platform consisting of three containerized services: a Discord bot, REST API, and Angular dashboard. The system uses Redis for real-time data synchronization and PostgreSQL for persistent storage.

## 🚀 Quick Start

### Development Mode (Recommended for development)

```bash
# Copy environment template
cp env.example .env

# Edit .env with your Discord credentials

# Start development environment with live reloading
./start-dev.sh          # Linux/Mac
start-dev.bat           # Windows
```

**Features:**
- 🔄 Live reloading for all services
- 📦 Shared types built locally and mounted as volumes
- 🐳 Docker Compose development environment
- 🎯 Hot reload for API, Bot, and Dashboard
- ⚡ Fast builds (no Docker duplication)

**Optional:** Run `watch-shared-types.sh` (Linux/Mac) or `watch-shared-types.bat` (Windows) in another terminal to automatically rebuild shared types when they change.

See [DEV_SETUP.md](./DEV_SETUP.md) for detailed development instructions.

### Production Mode

```bash
docker-compose up --build
```

## 🏗️ Project Architecture

```
project
├── api/          # REST API service (Express.js + TypeScript)
├── bot/          # Discord bot service (Discord.js + TypeScript)
├── dashboard/    # Angular frontend dashboard
└── docker-compose.yml  # Container orchestration
```

## 📋 Services Overview

### 🤖 Bot Service (`/bot`)

**Technology Stack:** Node.js, TypeScript, Discord.js v14, Redis

The Discord bot service is responsible for:
- **Discord Integration**: Connects to Discord using Discord.js with optimized memory usage
- **Real-time Data Sync**: Monitors Discord events and syncs guild data to Redis
- **Event Broadcasting**: Publishes changes via Redis pub/sub for real-time updates
- **Memory Optimization**: Uses limited caching and sweepers to maintain low RAM usage

**Key Features:**
- Syncs guild basics (name, icon, owner)
- Tracks roles and channels in real-time
- Monitors member permission changes
- Publishes events for dashboard real-time updates

**Dependencies:**
- `discord.js`: Discord API integration
- `ioredis`: Redis client for caching and pub/sub
- `bufferutil`: WebSocket performance optimization

### 🌐 API Service (`/api`)

**Technology Stack:** Node.js, TypeScript, Express.js, Redis

The REST API service provides:
- **Dashboard Data Access**: Endpoints for retrieving guild, role, and channel data
- **Discord Proxy**: Secure proxy for Discord API calls (message sending)
- **Real-time Events**: Server-Sent Events (SSE) for live dashboard updates
- **CORS Configuration**: Configured for dashboard communication

**Key Endpoints:**
- `GET /guilds/:guildId` - Get guild information
- `GET /guilds/:guildId/roles` - Get guild roles
- `GET /guilds/:guildId/channels` - Get guild channels
- `POST /messages.send` - Send messages to Discord channels
- `GET /events/:guildId` - SSE stream for real-time updates

**Dependencies:**
- `express`: Web framework
- `ioredis`: Redis client
- `cors`: Cross-origin resource sharing

### 🎨 Dashboard Service (`/dashboard`)

**Technology Stack:** Angular 20, TypeScript, SCSS, NgxExtension

The Angular dashboard provides:
- **Modern UI**: Angular 20 with standalone components
- **Real-time Updates**: EventSource integration for live data
- **Guild Management**: View and manage Discord guilds
- **Responsive Design**: Modern, responsive user interface

**Key Features:**
- Landing page
- Guild listing and selection
- Real-time guild dashboard with live updates
- Message sending capabilities

**Dependencies:**
- `@angular/core`: Angular framework
- `ngxtension`: Angular utilities and extensions
- `rxjs`: Reactive programming

## 🚀 Infrastructure

### 🐳 Docker Configuration

Each service includes:
- **Multi-stage Dockerfiles** for optimized production builds
- **Development and production targets**
- **Alpine Linux base** for minimal image size

### 🗃️ Data Storage

- **Redis**: Real-time caching, pub/sub messaging, session storage
- **PostgreSQL**: Persistent data storage (configured but not actively used in current codebase)

### 🔄 Real-time Architecture

The system implements a real-time architecture using:
1. **Discord Bot** monitors Discord events
2. **Redis Pub/Sub** broadcasts changes
3. **API SSE** streams updates to dashboard
4. **Dashboard EventSource** receives real-time updates

## 🛠️ Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 22+ (for local development)
- Discord Bot Token

### Environment Configuration

Create a `.env` file in the project root:

```env
# Discord Configuration
BOT_TOKEN=your_discord_bot_token_here

# Database Configuration
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=your_database_name
POSTGRES_HOST=postgres  # Use 'localhost' for local development

# Redis Configuration
REDIS_HOST=redis        # Use 'localhost' for local development

# API Configuration
PORT=3000
```

**Note:** For local development, change `POSTGRES_HOST` and `REDIS_HOST` to `localhost` in your `.env` file.

### 🐳 Docker Deployment (Recommended)

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd testing-stuff
   cp .env.example .env  # Configure your environment variables
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Dashboard: http://localhost
   - API: http://localhost:3000
   - Redis: localhost:6379
   - PostgreSQL: localhost:5432

### 💻 Local Development

**Important:** For local development, you need to run each service separately and have Redis and PostgreSQL running locally.

#### Prerequisites for Local Development

1. **Install and start Redis locally:**
   ```bash
   # Option 1: Using Docker
   docker run -d --name redis-dev -p 6379:6379 redis:alpine
   
   # Option 2: Install Redis as a service
   # On macOS: brew install redis && brew services start redis
   # On Ubuntu: sudo apt install redis-server && sudo systemctl start redis
   # On Windows: Download from https://redis.io/download
   ```

2. **Install and start PostgreSQL locally:**
   ```bash
   # Option 1: Using Docker
   docker run -d --name postgres-dev \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=public \
     -p 5432:5432 \
     postgres:15
   
   # Option 2: Install PostgreSQL as a service
   # On macOS: brew install postgresql && brew services start postgresql
   # On Ubuntu: sudo apt install postgresql postgresql-contrib && sudo systemctl start postgresql
   # On Windows: Download from https://www.postgresql.org/download/windows/
   ```

3. **Update environment variables for local development:**
   ```env
   # For local development, use localhost instead of service names
   POSTGRES_HOST=localhost
   REDIS_HOST=localhost
   ```

#### Bot Service
```bash
cd bot
npm install
npm run dev  # Uses ts-node-dev for hot reload
```

#### API Service
```bash
cd api
npm install
npm run dev  # Uses ts-node-dev for hot reload
```

#### Dashboard Service
```bash
cd dashboard
npm install
npm start  # Angular dev server on http://localhost:4200
```

#### Running Order
1. Start Redis and PostgreSQL first
2. Start the API service (depends on Redis and PostgreSQL)
3. Start the Bot service (depends on Redis)
4. Start the Dashboard service (depends on API)

**Note:** Each service runs independently on different ports:
- Bot: No web interface (Discord events only)
- API: http://localhost:3000
- Dashboard: http://localhost:4200
- Redis: localhost:6379
- PostgreSQL: localhost:5432

## 🔧 Configuration Details

### Bot Memory Optimization

The bot uses aggressive caching limits and sweepers to maintain low memory usage:
- Limited user and member caching
- Disabled unnecessary managers
- Automatic cache cleanup

### API CORS Configuration

The API is configured to accept requests from:
- `http://localhost:4200` (Angular dev server)
- Credentials support for SSE connections

## 🎯 Usage

1. **Invite the bot** to your Discord server with appropriate permissions
2. **Access the dashboard** at http://localhost:4200
3. **Select a guild** from the guilds page
4. **Monitor real-time updates** as Discord events occur
5. **Send messages** through the dashboard interface

## 🔒 Security Considerations

- Bot token stored in environment variables
- API CORS properly configured
- Discord API calls proxied through secure backend
- Rate limiting handled transparently

## 🚀 Production Deployment

The project is designed for containerized deployment:

1. Configure production environment variables
2. Use `docker-compose up -d` for production deployment
3. Consider using Docker Swarm or Kubernetes for scaling
4. Set up proper monitoring and logging

## 📝 Development Notes

- **TypeScript**: All services use TypeScript for type safety
- **Hot Reload**: Development scripts include hot reload capabilities
- **Memory Efficient**: Bot service optimized for low memory usage
- **Real-time**: Full real-time synchronization between Discord and dashboard
- **Modular**: Each service is independently containerized and scalable

## 🤝 Contributing

1. Follow TypeScript best practices
2. Maintain Docker compatibility
3. Test real-time functionality
4. Update documentation for new features

---

*This project demonstrates a modern microservices architecture for Discord bot management with real-time capabilities and a responsive web interface.*

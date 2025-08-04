# Installation & Setup Guide

This guide will help you set up Kraken for development on your local machine.

## 📋 Prerequisites

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://docs.docker.com/get-docker/)
- **Git** - [Download](https://git-scm.com/)

### Recommended Tools
- **VS Code** with extensions:
  - TypeScript and JavaScript Language Features
  - Prisma (for database schema)
  - Docker (for container management)
  - ESLint & Prettier (for code quality)

## 🚀 Quick Start (Docker - Recommended)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/kraken.git
cd kraken
```

### 2. Environment Configuration
```bash
# Copy environment template
cp backend/env.sample backend/.env

# Edit the environment file
nano backend/.env  # or your preferred editor
```

**Important Environment Variables:**
```env
# Database
MONGODB_URL="mongodb://localhost:27017/kraken?replicaSet=rs0"

# JWT Secrets (CHANGE THESE!)
JWT_ACCESS_SECRET="your-super-secret-jwt-access-key"
JWT_REFRESH_SECRET="your-super-secret-jwt-refresh-key"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# LiveKit (Optional - for voice/video)
LIVEKIT_API_KEY=""
LIVEKIT_API_SECRET=""
LIVEKIT_URL=""
```

### 3. Start All Services
```bash
# Start all services (MongoDB, Redis, Backend, Frontend)
docker-compose up

# Or run in background
docker-compose up -d
```

### 4. Initialize Database
```bash
# Generate Prisma client and push schema
docker compose run backend npm run prisma:generate
docker compose run backend npm run prisma:push

# Optional: Seed default data
docker compose run backend npm run seed
```

### 5. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **MongoDB**: mongodb://localhost:27017
- **Redis**: localhost:6379

## 🛠️ Manual Development Setup

If you prefer to run services individually:

### 1. Database Setup

#### MongoDB with Replica Set
```bash
# Start MongoDB with replica set
mongod --replSet rs0 --port 27017 --dbpath /path/to/data

# Initialize replica set (in mongo shell)
mongo
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
```

#### Redis
```bash
# Start Redis server
redis-server
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Push database schema
npm run prisma:push

# Start development server
npm run start:dev
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Development Commands

### Backend Commands
```bash
cd backend

# Development
npm run start:dev        # Hot reload development server
npm run start:debug      # Debug mode with inspector
npm run build           # Build for production
npm run start:prod      # Start production build

# Database
npm run prisma:generate # Generate Prisma client
npm run prisma:push     # Push schema to database
npm run prisma         # Generate + push (combined)

# Testing
npm run test           # Unit tests
npm run test:cov       # Test with coverage
npm run test:e2e       # End-to-end tests
npm run test:watch     # Watch mode

# Code Quality
npm run lint           # ESLint check
npm run format         # Prettier format
```

### Frontend Commands
```bash
cd frontend

# Development
npm run dev            # Vite dev server (hot reload)
npm run build          # Build for production
npm run preview        # Preview production build

# Electron (Desktop App)
npm run electron-dev   # Electron development

# Code Quality
npm run lint           # ESLint check
npm run lint:fix       # ESLint fix
```

### Docker Commands
```bash
# All services
docker-compose up                    # Start all services
docker-compose up -d                 # Start in background
docker-compose down                  # Stop all services
docker-compose build --no-cache      # Rebuild containers

# Individual services
docker-compose up backend            # Start only backend
docker-compose up frontend           # Start only frontend

# Shell access
docker compose run backend bash      # Backend shell
docker compose run frontend sh       # Frontend shell

# Database operations in container
docker compose run backend npm run prisma:generate
docker compose run backend npm run prisma:push
```

## 🗄️ Database Configuration

### MongoDB Replica Set Setup
Kraken requires MongoDB replica set for change streams (real-time features):

#### Using Docker (Automatic)
The docker-compose.yml automatically configures the replica set.

#### Manual Setup
```bash
# Start MongoDB with replica set
mongod --replSet rs0 --port 27017

# Connect and initialize
mongo
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
})
```

### Database Seeding
```bash
# Create default roles and sample data
npm run seed
```

## 🔐 LiveKit Setup (Voice/Video)

### 1. Create LiveKit Account
1. Sign up at [LiveKit Cloud](https://cloud.livekit.io/)
2. Create a new project
3. Get your API Key and Secret

### 2. Configure Environment
```env
LIVEKIT_API_KEY="your-api-key"
LIVEKIT_API_SECRET="your-api-secret"  
LIVEKIT_URL="wss://your-project.livekit.cloud"
```

### 3. Local LiveKit Server (Alternative)
```bash
# Run local LiveKit server
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server --dev
```

## 🧪 Testing Setup

### Backend Testing
```bash
cd backend

# Unit tests
npm run test

# E2E tests (requires running services)  
npm run test:e2e

# Test with coverage
npm run test:cov

# Watch mode for development
npm run test:watch
```

### Frontend Testing
```bash
cd frontend

# Run tests (when implemented)
npm run test
```

## 🚨 Troubleshooting

### Common Issues

#### "Replica set not initialized"
```bash
# Connect to MongoDB and initialize
mongo
rs.initiate()
```

#### "Port already in use"
```bash
# Check what's using the port
lsof -i :3000  # Backend port
lsof -i :5173  # Frontend port

# Kill processes if needed
kill -9 <PID>
```

#### "Prisma client not generated"
```bash
cd backend
npm run prisma:generate
```

#### "Cannot connect to MongoDB"
- Ensure MongoDB is running with replica set
- Check MONGODB_URL in .env file
- Verify MongoDB is accessible

#### "LiveKit connection failed"
- Check LIVEKIT_* environment variables
- Verify LiveKit server is accessible
- Voice/video features will be disabled if misconfigured

### Docker Issues

#### "Container won't start"
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild containers
docker-compose build --no-cache
```

#### "Volume permission issues"
```bash
# Fix permissions (Linux/Mac)
sudo chown -R $USER:$USER .
```

## 📊 Verification

### Health Checks
1. **Backend**: http://localhost:3000/health (if implemented)
2. **Frontend**: http://localhost:5173 should load
3. **Database**: Connection logs in backend console
4. **Redis**: Backend should connect without errors

### Feature Testing
1. **Registration**: Create a new user account
2. **Community**: Create a community/server
3. **Channels**: Create text and voice channels
4. **Messages**: Send messages in text channels
5. **Voice**: Join voice channels (if LiveKit configured)

## 🔄 Next Steps

After successful installation:

1. **Read Documentation**: Check `docs/` folder for architecture details
2. **Review Features**: See `docs/features/discord-parity.md` for current capabilities
3. **Development**: Follow patterns in existing code
4. **Contributing**: Check `CONTRIBUTING.md` for guidelines

## 📞 Support

If you encounter issues:

1. Check this troubleshooting section
2. Review logs for error messages
3. Search existing GitHub issues
4. Create a new issue with detailed information

**Logs to include when reporting issues:**
- Backend logs: `docker-compose logs backend`
- Frontend logs: Browser console errors
- Database logs: MongoDB connection errors
- Environment: OS, Node.js version, Docker version
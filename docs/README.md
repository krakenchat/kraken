# Kraken Documentation

Welcome to the comprehensive documentation for **Kraken**, a Discord-like voice chat application built with modern web technologies.

## 📖 Documentation Structure

### Architecture
- [**Backend Architecture**](./architecture/backend.md) - NestJS modules, services, and design patterns
- [**Frontend Architecture**](./architecture/frontend.md) - React components, state management, and UI patterns
- [**Database Schema**](./architecture/database.md) - MongoDB collections, relationships, and data modeling
- [**Real-time Systems**](./architecture/realtime.md) - WebSocket implementation and LiveKit integration

### Features
- [**Discord Feature Parity**](./features/discord-parity.md) - Comprehensive comparison with Discord features
- [**Authentication & Authorization**](./features/auth-rbac.md) - JWT auth and role-based access control
- [**Voice & Video Calls**](./features/voice-video.md) - LiveKit integration and voice channel implementation
- [**Messaging System**](./features/messaging.md) - Real-time messaging with rich text support
- [**Community Management**](./features/communities.md) - Server-like organization and member management
- [**Incomplete Features**](./features/incomplete.md) - Features with foundation but need completion

### API Documentation
- [**REST API Reference**](./api/rest.md) - All HTTP endpoints with examples
- [**WebSocket Events**](./api/websocket.md) - Real-time event documentation
- [**Database Operations**](./api/database.md) - Prisma operations and queries

### Development
- [**Setup Guide**](./setup/installation.md) - Complete installation and configuration
- [**Development Workflow**](./development/workflow.md) - Best practices and common tasks
- [**Testing Strategy**](./development/testing.md) - Unit, integration, and e2e testing
- [**Deployment Guide**](./setup/deployment.md) - Production deployment strategies

## 🚀 Quick Links

### Getting Started
1. [Installation Guide](./setup/installation.md) - Set up your development environment
2. [Architecture Overview](./architecture/backend.md) - Understand the system design
3. [Feature Comparison](./features/discord-parity.md) - See what's implemented vs Discord

### Development
- [Backend Development](./development/workflow.md#backend-development)
- [Frontend Development](./development/workflow.md#frontend-development)
- [Database Operations](./development/workflow.md#database-operations)

### Key Features Status
| Feature | Status | Discord Parity |
|---------|--------|----------------|
| **Communities/Servers** | ✅ Implemented | 80% |
| **Text Channels** | ✅ Implemented | 85% |
| **Voice Channels** | ✅ Implemented | 70% |
| **Video Calls** | ✅ Implemented | 60% |
| **Role-Based Auth** | 🔧 Foundation | 40% |
| **Direct Messages** | 🔧 Foundation | 30% |
| **Reactions & Emojis** | 🔧 Foundation | 20% |
| **File Attachments** | 🔧 Foundation | 25% |
| **Mobile App** | ❌ Planned | 0% |

**Legend:** ✅ Complete | 🔧 Foundation/Incomplete | ❌ Not Started

## 🏗️ System Overview

Kraken is built as a modern, scalable chat application with the following key components:

- **Backend**: NestJS with MongoDB and Redis
- **Frontend**: React 19 with Redux Toolkit and Material-UI
- **Real-time**: Socket.IO with Redis adapter for scaling
- **Voice/Video**: LiveKit integration for WebRTC
- **Authentication**: JWT with role-based access control (RBAC)
- **Database**: MongoDB with Prisma ORM

## 📋 Current Priorities

Based on the codebase analysis, here are the key areas that need attention:

### High Priority
1. **Complete Role-Based Access Control** - Full RBAC implementation across all features
2. **Direct Message System** - Complete the DM foundation that's been laid
3. **Mobile Responsiveness** - Optimize UI for mobile devices
4. **File Upload System** - Complete attachment handling

### Medium Priority
1. **Voice Persistence** - Maintain voice connections across navigation
2. **Advanced Messaging** - Rich text, embeds, code blocks
3. **Community Moderation** - Advanced admin tools
4. **Performance Optimization** - Database queries and caching

### Future Features
1. **Mobile Applications** - React Native or Electron
2. **Advanced Voice Features** - Push-to-talk, noise suppression
3. **Integration APIs** - Webhooks, bots, third-party integrations
4. **Enterprise Features** - SSO, audit logs, compliance

## 🔗 Related Resources

- [Contributing Guidelines](../CONTRIBUTING.md)
- [License Information](../LICENSE.md)
- [Development Setup](../CLAUDE.md)
- [Project Roadmap](./features/roadmap.md)
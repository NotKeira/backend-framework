# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.5] - 2025-08-01

### Added

- **Department Roster Management System**

  - Department creation and management with configurable settings
  - Member assignment with ranks, units, and status tracking
  - Support for multiple member statuses (active, inactive, suspended, terminated)
  - Bulk operations for rank updates and member management
  - CSV export functionality for department rosters
  - Department statistics and member search capabilities
  - Comprehensive member lifecycle management

- **Applications Management System**

  - Dynamic application form creation with configurable field types
  - Application submission and review workflow
  - Support for multiple application types (staff, LOA, RA, department, custom)
  - Application status tracking (pending, approved, denied, under_review)
  - Form field validation with custom rules and patterns
  - Application statistics and search functionality
  - Review system with notes, tags, and approval workflow

- **Custom Authentication Service**

  - Discord OAuth2 integration with custom JWT implementation
  - Secure session management with database storage
  - User role-based permissions (admin, staff, member)
  - Server-specific permission management
  - Session validation and automatic cleanup
  - Password-less authentication flow
  - Multi-server user management

- **Comprehensive Database Infrastructure**
  - Complete database schema for all Operix features
  - Drizzle ORM integration with PostgreSQL support
  - Database connection management with connection pooling
  - Migration system for schema updates
  - Transaction support for complex operations
  - Comprehensive data models for all entities

### Changed

- **Database Service Modernization**

  - Replaced mock database implementation with Drizzle ORM
  - Added proper connection management and transaction support
  - Implemented real database testing and connection validation
  - Updated to use extensionless imports for consistency

- **Dependencies**
  - Added `drizzle-orm` for database operations
  - Added `pg` and `@types/pg` for PostgreSQL support
  - Added `drizzle-kit` for database migrations and tooling
  - Added `bcryptjs`, `jsonwebtoken`, `zod`, `uuid` for authentication and validation

### Technical Details

#### Database Schema

- **Users Table**: Discord integration, global roles, session management
- **Servers Table**: Guild management, settings, branding configuration
- **Server Members Table**: User-server relationships, roles, permissions
- **Departments Table**: Department types, settings, configurations
- **Department Members Table**: Member assignments, ranks, units, status tracking
- **Application Forms Table**: Dynamic form creation, field configurations
- **Applications Table**: Submission data, review status, workflow management
- **Training Tables**: Certification management, session tracking, attendance
- **Patrol Tables**: Scheduling, participation, logging system
- **Unit Status Table**: Real-time unit tracking, dispatcher integration
- **Files Table**: CDN management, visibility controls, download tracking
- **Analytics Table**: Event tracking, reporting data
- **Sessions Table**: Authentication sessions, security tracking

#### Services Architecture

- **OperixAuthService**: Complete authentication and authorization
- **ApplicationsService**: Form management and submission workflow
- **RosterService**: Department and member management
- **DatabaseService**: ORM integration and connection management

#### Security Features

- Custom JWT implementation with secure token generation
- Session-based authentication with database persistence
- Role-based access control with hierarchical permissions
- Input validation and sanitization for all endpoints
- SQL injection protection through ORM parameterization

## [1.1.4] - 2025-07-26

### Added

- Comprehensive documentation and development setup
- Detailed README with project overview and architecture
- Environment configuration template (.env.example)
- Development scripts with hot reload support
- Quick start guide and project structure documentation

### Changed

- Removed @evotrix/framework dependency
- Updated package.json with development tooling

## [1.1.3] - 2025-07-26

### Added

- Modular system architecture with auth, database, and API modules
- Main application entry point with graceful shutdown
- Authentication module with OAuth provider support
- Database module with connection management and repository pattern
- API module with HTTP server, routing, and middleware
- Comprehensive middleware suite (CORS, rate limiting, logging, validation)
- Consistent interface patterns for lifecycle management

## [1.1.2] - 2025-07-26

### Added

- Core framework implementation
- Application manager with service orchestration
- Service manager with dependency injection
- Module manager for feature organization
- Middleware manager for request processing

## [1.1.1] - 2025-07-26

### Added

- Comprehensive utility library
- Advanced logging system with multiple formats
- Event system for application communication
- Validation helpers with Zod integration
- Async operation utilities

## [1.1.0] - 2025-07-26

### Added

- Configuration management system
- Environment variable parsing and validation
- Type-safe configuration providers
- Support for multiple configuration sources

### Changed

- License updated to Apache 2.0

## [1.0.0] - 2025-07-26

### Added

- Initial project structure
- TypeScript configuration
- Comprehensive type definitions for modular architecture
- Package management setup with pnpm
- Basic project foundation

[1.1.5]: https://github.com/Operix-Devlopment/operix.backend/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/Operix-Devlopment/operix.backend/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/Operix-Devlopment/operix.backend/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/Operix-Devlopment/operix.backend/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Operix-Devlopment/operix.backend/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Operix-Devlopment/operix.backend/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Operix-Devlopment/operix.backend/releases/tag/v1.0.0

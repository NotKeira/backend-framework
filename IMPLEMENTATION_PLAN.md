## Implementation Plan for Remaining Backend Features

Based on your existing architecture, here's how we would implement the three remaining features:

### 1. **Public Server Pages Service**

```typescript
// src/modules/operix/public-pages-service.ts
```

**Key Features:**

- Public server landing pages with customizable branding
- Department showcases with member counts and recruitment status
- Server statistics and recent activity
- Custom pages for announcements, rules, etc.
- SEO-friendly URLs and metadata

**Database Extensions Needed:**

```sql
-- Add to servers table settings
ALTER TABLE servers ADD COLUMN IF NOT EXISTS public_settings JSONB;

-- New table for custom pages
CREATE TABLE public_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  content TEXT,
  is_published BOOLEAN DEFAULT false,
  meta_description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(server_id, slug)
);
```

**API Endpoints:**

- `GET /public/:serverId` - Server landing page
- `GET /public/:serverId/departments` - Department showcase
- `GET /public/:serverId/pages/:slug` - Custom pages
- `GET /public/:serverId/stats` - Public statistics

---

### 2. **User & Server Settings Service**

```typescript
// src/modules/operix/settings-service.ts
```

**User Settings Features:**

- Personal preferences (theme, notifications, timezone)
- Privacy settings (profile visibility, contact preferences)
- Application preferences and saved forms
- Notification subscriptions per server
- Custom dashboard configuration

**Server Settings Features:**

- Branding customization (colors, logos, themes)
- Feature toggles (enable/disable modules)
- Integration settings (Discord webhooks, external APIs)
- Permission templates and role management
- Backup and export configurations

**Database Extensions:**

```sql
-- User preferences
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  server_id UUID REFERENCES servers(id), -- NULL for global settings
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, server_id)
);

-- Server configuration templates
CREATE TABLE server_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- 'department', 'application', 'role'
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API Endpoints:**

- `GET/PUT /settings/user/:userId` - User preferences
- `GET/PUT /settings/server/:serverId` - Server configuration
- `GET/POST /settings/templates/:serverId` - Configuration templates
- `GET/PUT /settings/permissions/:serverId` - Permission management

---

### 3. **Analytics & Reporting Service**

```typescript
// src/modules/operix/analytics-service.ts
```

**Analytics Features:**

- Application submission trends and approval rates
- Department member growth and retention
- Training completion rates and certification tracking
- Unit activity patterns and response times
- File usage and storage analytics
- Custom dashboard creation with widgets

**Reporting Features:**

- Automated weekly/monthly reports
- Custom report builder with filters
- Export capabilities (PDF, CSV, Excel)
- Scheduled report delivery
- Comparative analytics between departments

**Database Extensions:**

```sql
-- Enhanced analytics with aggregations
CREATE TABLE analytics_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  dimension VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(server_id, metric_type, dimension, period_start, period_end)
);

-- Custom reports
CREATE TABLE custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config JSONB NOT NULL, -- filters, metrics, visualization
  schedule VARCHAR(20), -- 'daily', 'weekly', 'monthly'
  recipients JSONB, -- email list or webhook URLs
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Metrics Tracked:**

- Application conversion rates by department
- Member retention and churn rates
- Training effectiveness and completion rates
- Unit utilization and response efficiency
- File access patterns and storage trends
- User engagement and feature adoption

**API Endpoints:**

- `GET /analytics/:serverId/dashboard` - Main analytics dashboard
- `GET /analytics/:serverId/metrics/:type` - Specific metric data
- `POST /analytics/:serverId/reports` - Create custom report
- `GET /analytics/:serverId/exports/:format` - Export data

---

## Implementation Strategy

### Phase 1: Database Schema Updates

1. Add missing tables and columns to existing schema
2. Create migration scripts for new structures
3. Update TypeScript types and interfaces

### Phase 2: Core Services

1. Implement each service with full CRUD operations
2. Add proper error handling and validation
3. Integrate with existing authentication and database services

### Phase 3: API Integration

1. Create HTTP routes for all endpoints
2. Add middleware for authentication and permissions
3. Implement real-time updates where needed (WebSocket)

### Phase 4: Advanced Features

1. Automated analytics aggregation (background jobs)
2. Report scheduling and delivery
3. Public page SEO optimization
4. Settings import/export functionality

Would you like me to implement any of these services in detail, or should we start with the API route integration for the existing services?

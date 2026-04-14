/**
 * Seed: Todos.
 *
 * Generates ~250 todo items distributed across all project-user
 * combinations. Uses themed templates per user (matching their persona)
 * and a deterministic generator function to create varied data.
 *
 * Distribution:
 *   Backend API (Acme):
 *     - john.doe  (owner)  → 30 todos
 *     - jane.doe  (admin)  → 25 todos
 *     - alex      (member) → 20 todos
 *
 *   Frontend Dashboard (Acme):
 *     - jane.doe  (owner)  → 30 todos
 *     - john.doe  (member) → 20 todos
 *     - alex      (member) → 20 todos
 *     - sudo_sam  (viewer) → 10 todos
 *
 *   Infrastructure (Globex):
 *     - cloud     (owner)  → 30 todos
 *     - alex      (member) → 20 todos
 *     - sudo_sam  (admin)  → 25 todos
 *
 * Total: ~230 todos (actual count depends on project-user combos)
 *
 * @module seeds/09_todos
 */

import crypto from "node:crypto"
import { USER_IDS } from "./02_users.js"
import { PROJECT_IDS } from "./07_projects.js"

// ── Per-user themed todo templates ────────────────────────────────────
// Each user has 10 templates reflecting their persona. The generator
// cycles through templates and appends variant numbers for extras.

/**
 * john.doe templates — Backend developer: API debugging, testing, optimization.
 * @type {Array<{ title: string, description: string }>}
 */
const johnDoeTemplates = [
  {
    title: "Debug slow response on /api/users endpoint",
    description: "Response times spiking to 3s+ under load. Profile the query plan and check for N+1 issues.",
  },
  {
    title: "Add request tracing with correlation IDs",
    description:
      "Implement distributed tracing headers across all services for better debugging in production.",
  },
  {
    title: "Write integration tests for order processing",
    description:
      "Cover the full order lifecycle: create, payment, fulfillment, and cancellation flows.",
  },
  {
    title: "Implement graceful shutdown handling",
    description:
      "Server needs to drain connections and finish in-flight requests before stopping on SIGTERM.",
  },
  {
    title: "Optimize bulk import endpoint",
    description: "CSV import of 10k+ records is timing out. Implement streaming parser and batch inserts.",
  },
  {
    title: "Fix race condition in inventory update",
    description: "Concurrent requests can oversell items. Add optimistic locking or SELECT FOR UPDATE.",
  },
  {
    title: "Add structured JSON logging",
    description:
      "Replace console.log calls with structured logger. Include request ID, user ID, and operation context.",
  },
  {
    title: "Implement idempotency keys for POST endpoints",
    description: "Prevent duplicate resource creation from retried requests. Store keys in Redis with TTL.",
  },
  {
    title: "Fix timezone handling in date filters",
    description:
      "API returns different results depending on server timezone. Normalize all dates to UTC.",
  },
  {
    title: "Add retry logic for external API calls",
    description:
      "Third-party payment API has intermittent failures. Implement exponential backoff with jitter.",
  },
]

/**
 * jane.doe templates — Full-stack developer: frontend/backend integration, UX, docs.
 * @type {Array<{ title: string, description: string }>}
 */
const janeDoeTemplates = [
  {
    title: "Build reusable form component with validation",
    description:
      "Create a generic form component that handles validation, error display, and submission state.",
  },
  {
    title: "Implement dark mode toggle with CSS variables",
    description: "Add system preference detection and manual toggle. Persist preference in localStorage.",
  },
  {
    title: "Implement optimistic UI updates for todo actions",
    description:
      "Update the UI immediately on action, then reconcile with server response or rollback on error.",
  },
  {
    title: "Fix infinite scroll performance issues",
    description: "List component re-renders all items on new page load. Implement virtualized scrolling.",
  },
  {
    title: "Build notification toast system",
    description:
      "Create a toast notification component with auto-dismiss, stacking, and action buttons.",
  },
  {
    title: "Add keyboard shortcuts for power users",
    description:
      "Implement Cmd+K command palette and shortcuts for common actions like navigation and search.",
  },
  {
    title: "Implement search with debounced input",
    description: "Add search functionality with debounce to avoid excessive API calls while typing.",
  },
  {
    title: "Fix mobile responsive layout breakpoints",
    description:
      "Dashboard sidebar overlaps content on tablet viewports. Adjust breakpoints and add collapsible nav.",
  },
  {
    title: "Add error boundary with fallback UI",
    description: "Wrap route components in error boundaries that show a friendly message and retry button.",
  },
  {
    title: "Add loading skeletons for async content",
    description:
      "Replace spinners with skeleton screens matching the layout of the content being loaded.",
  },
]

/**
 * AlexTheBuilder templates — Frontend/DevOps: React, CI/CD, build tools, testing.
 * @type {Array<{ title: string, description: string }>}
 */
const alexTemplates = [
  {
    title: "Configure Vite build optimization",
    description:
      "Bundle size is too large. Set up code splitting, tree shaking, and analyze output with visualizer.",
  },
  {
    title: "Set up GitHub Actions matrix for cross-browser testing",
    description: "Run Playwright tests across Chrome, Firefox, and Safari in parallel CI jobs.",
  },
  {
    title: "Create Docker Compose for local development",
    description:
      "Single command to spin up API, database, Redis, and mail server for local development.",
  },
  {
    title: "Fix flaky Cypress tests in CI",
    description:
      "E2E tests fail intermittently due to timing issues. Add proper waits and stabilize selectors.",
  },
  {
    title: "Implement component lazy loading with Suspense",
    description: "Wrap heavy route components in Suspense boundaries with loading fallbacks.",
  },
  {
    title: "Set up Renovate for automated dependency updates",
    description:
      "Configure Renovate bot with grouping rules, auto-merge for patch updates, and schedules.",
  },
  {
    title: "Create reusable GitHub Actions workflow templates",
    description:
      "Build shared workflow templates for linting, testing, building, and deploying across repos.",
  },
  {
    title: "Set up Docker layer caching in CI",
    description:
      "Optimize Docker build times by properly ordering layers and using BuildKit cache mounts.",
  },
  {
    title: "Configure multi-stage Dockerfile for Node app",
    description:
      "Separate build and runtime stages. Use distroless base image for smallest possible container.",
  },
  {
    title: "Build design system tokens pipeline",
    description:
      "Transform Figma design tokens to CSS variables, Tailwind config, and TypeScript constants.",
  },
]

/**
 * CloudArchitect templates — Infrastructure: AWS, Kubernetes, networking, security.
 * @type {Array<{ title: string, description: string }>}
 */
const cloudTemplates = [
  {
    title: "Configure Kubernetes horizontal pod autoscaler",
    description: "Set up HPA based on CPU, memory, and custom metrics from Prometheus.",
  },
  {
    title: "Implement AWS WAF rules for API protection",
    description: "Add rate limiting, geo-blocking, and SQL injection protection rules to the WAF.",
  },
  {
    title: "Create Terraform modules for standard infrastructure",
    description: "Build reusable modules for VPC, ECS clusters, RDS instances, and S3 buckets.",
  },
  {
    title: "Set up Vault for secrets management",
    description:
      "Deploy HashiCorp Vault with auto-unseal. Migrate hardcoded secrets from environment variables.",
  },
  {
    title: "Design blue-green deployment strategy",
    description: "Implement zero-downtime deployments using ALB target group switching.",
  },
  {
    title: "Configure PagerDuty alerting integration",
    description:
      "Set up alert routing, escalation policies, and on-call schedules for production incidents.",
  },
  {
    title: "Set up GitOps with ArgoCD",
    description:
      "Configure ArgoCD for declarative deployments synced from the infrastructure Git repository.",
  },
  {
    title: "Implement container image scanning in CI",
    description: "Add Trivy or Snyk scanning to detect vulnerabilities in container images before deployment.",
  },
  {
    title: "Set up Prometheus and Grafana monitoring stack",
    description:
      "Deploy monitoring stack with custom dashboards for application, infrastructure, and business metrics.",
  },
  {
    title: "Implement chaos engineering with Litmus",
    description: "Set up chaos experiments for pod failures, network latency, and node drains in staging.",
  },
]

/**
 * sudo_sam templates — Architect: system design, documentation, standards, evaluation.
 * @type {Array<{ title: string, description: string }>}
 */
const sudoSamTemplates = [
  {
    title: "Draft ADR for message queue selection",
    description:
      "Compare RabbitMQ, SQS, and Kafka for our event-driven needs. Document decision and rationale.",
  },
  {
    title: "Create system context diagram for platform",
    description: "Map all external systems, actors, and integration points in a C4 Level 1 diagram.",
  },
  {
    title: "Define coding standards for backend services",
    description:
      "Document naming conventions, error handling patterns, logging standards, and testing requirements.",
  },
  {
    title: "Design event sourcing pattern for order system",
    description:
      "Architect event store schema, projection rebuilding, and snapshot strategy for the order domain.",
  },
  {
    title: "Create threat model for authentication flow",
    description: "Identify attack vectors using STRIDE framework. Document mitigations for each threat.",
  },
  {
    title: "Write technical specification for search feature",
    description:
      "Evaluate Elasticsearch vs Typesense. Design index schema, query DSL, and relevance tuning.",
  },
  {
    title: "Define API design guidelines for the organization",
    description:
      "Document REST conventions, pagination, filtering, error formats, and naming standards.",
  },
  {
    title: "Architect WebSocket gateway for real-time features",
    description:
      "Design connection management, room-based subscriptions, and horizontal scaling with Redis pub/sub.",
  },
  {
    title: "Create technology radar for team adoption",
    description:
      "Categorize technologies into adopt, trial, assess, and hold based on team experience and goals.",
  },
  {
    title: "Design feature flag architecture",
    description:
      "Architect a feature flag system supporting gradual rollouts, A/B tests, and user targeting.",
  },
]

/**
 * Template lookup by user ID for the generator function.
 * @type {Record<string, Array<{ title: string, description: string }>>}
 */
const TEMPLATES_BY_USER = {
  [USER_IDS.john_doe]: johnDoeTemplates,
  [USER_IDS.jane_doe]: janeDoeTemplates,
  [USER_IDS.alex]: alexTemplates,
  [USER_IDS.cloud]: cloudTemplates,
  [USER_IDS.sudo_sam]: sudoSamTemplates,
}

/**
 * Generate todo items for a specific user within a specific project.
 *
 * Cycles through the user's themed templates, appending variant numbers
 * when the count exceeds the template count. Completion status follows
 * a ~40% pattern (every 5th pair of items is completed).
 *
 * @param {string} projectId - The project UUID
 * @param {string} userId - The user UUID
 * @param {number} count - Number of todos to generate
 * @param {Date} baseDate - Starting date for timestamp generation
 * @returns {Array<object>} Array of todo row objects ready for insertion
 */
function generateTodos(projectId, userId, count, baseDate) {
  const templates = TEMPLATES_BY_USER[userId]
  const generated = []

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length]
    const variant = Math.floor(i / templates.length) + 1

    // Append variant number for repeated template cycles
    let title = template.title
    if (variant > 1) {
      title = `${template.title} (v${variant})`
    }

    // Space todos 1 hour apart for realistic timestamps
    const createdAt = new Date(baseDate.getTime() + i * 3600000)

    // ~40% completion rate — first 2 of every 5 todos are completed
    const isCompleted = i % 5 < 2

    generated.push({
      id: crypto.randomUUID(),
      project_id: projectId,
      user_id: userId,
      title,
      description: template.description,
      is_completed: isCompleted,
      created_at: createdAt.toISOString(),
      updated_at: isCompleted
        ? new Date(createdAt.getTime() + 86400000).toISOString() // completed 1 day later
        : createdAt.toISOString(),
    })
  }

  return generated
}

/**
 * Seed the todos table with ~230 generated todos across all projects.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seeding is not allowed in production")

  // Base dates staggered per project for realistic timelines
  const backendBaseDate = new Date("2025-03-01T09:00:00.000Z")
  const frontendBaseDate = new Date("2025-03-10T09:00:00.000Z")
  const infraBaseDate = new Date("2025-03-15T09:00:00.000Z")

  const allTodos = [
    // ── Backend API (Acme Corp) ─────────────────────────────────────
    // john.doe is the project owner — highest todo count
    ...generateTodos(PROJECT_IDS.backend_api, USER_IDS.john_doe, 30, backendBaseDate),
    // jane.doe is admin — active contributor
    ...generateTodos(PROJECT_IDS.backend_api, USER_IDS.jane_doe, 25, backendBaseDate),
    // alex is a member — moderate contribution
    ...generateTodos(PROJECT_IDS.backend_api, USER_IDS.alex, 20, backendBaseDate),

    // ── Frontend Dashboard (Acme Corp) ──────────────────────────────
    // jane.doe is the project owner — highest todo count
    ...generateTodos(PROJECT_IDS.frontend_dashboard, USER_IDS.jane_doe, 30, frontendBaseDate),
    // john.doe is a member — backend support tasks
    ...generateTodos(PROJECT_IDS.frontend_dashboard, USER_IDS.john_doe, 20, frontendBaseDate),
    // alex is a member — CI/CD and build tasks
    ...generateTodos(PROJECT_IDS.frontend_dashboard, USER_IDS.alex, 20, frontendBaseDate),
    // sudo_sam is a viewer — fewer todos (read-heavy role)
    ...generateTodos(PROJECT_IDS.frontend_dashboard, USER_IDS.sudo_sam, 10, frontendBaseDate),

    // ── Infrastructure (Globex Corporation) ─────────────────────────
    // CloudArchitect is the project owner — highest todo count
    ...generateTodos(PROJECT_IDS.infrastructure, USER_IDS.cloud, 30, infraBaseDate),
    // alex is a member — cross-org contributor
    ...generateTodos(PROJECT_IDS.infrastructure, USER_IDS.alex, 20, infraBaseDate),
    // sudo_sam is admin — active in Globex
    ...generateTodos(PROJECT_IDS.infrastructure, USER_IDS.sudo_sam, 25, infraBaseDate),
  ]

  // Clear existing todos
  await knex("todos").del()

  // Insert in batches of 100 to avoid exceeding PostgreSQL parameter limits
  for (let i = 0; i < allTodos.length; i += 100) {
    await knex("todos").insert(allTodos.slice(i, i + 100))
  }
}

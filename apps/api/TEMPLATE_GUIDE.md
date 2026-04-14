# Template Guide

This guide explains how to use this Express API template as a starting point for your own projects. It covers the architecture, patterns, and step-by-step instructions for adding new features.

## Introduction

This template provides a production-ready foundation for building RESTful APIs with Express.js, PostgreSQL, and JWT authentication. It includes:

- Clean MVC architecture
- JWT authentication with access/refresh tokens
- Standardized error handling and API responses
- Input validation with Joi
- Database migrations with Knex.js
- Security best practices (Helmet, CORS, Argon2)
- Comprehensive logging with Winston and Morgan

**Who should use this guide?** Developers who want to clone this template and extend it with new features.

## Architecture Deep Dive

### MVC Pattern

The template follows the Model-View-Controller (MVC) pattern with clear separation of concerns:

```
src/
├── models/         # Data access layer (Knex queries)
├── controllers/    # Business logic (validation, orchestration)
└── routes/         # Route definitions (URL mapping)
```

#### Models (`src/models/`)

Models handle all database operations using the Knex query builder. Each model exports functions for CRUD operations.

**Example: `src/models/todos.js`**

```javascript
import db from "../config/database.js"

const TABLE_NAME = "todos"

// Create a new record
export const create = (todo) => {
  return db.insert(todo).into(TABLE_NAME).returning("*")
}

// Find one record by conditions
export const findOne = (conditions) => {
  return db.select("*").from(TABLE_NAME).where(conditions).first()
}

// Find many records with optional sorting
export const findMany = (conditions, orders = null) => {
  let query = db.select("*").from(TABLE_NAME).where(conditions)
  if (orders) {
    query = query.orderBy(orders)
  }
  return query
}

// Find with pagination
export const findManyPaginated = (conditions, options = {}) => {
  const { limit = 10, offset = 0, orders = null } = options
  let query = db.select("*").from(TABLE_NAME).where(conditions)
  if (orders) query = query.orderBy(orders)
  return query.limit(limit).offset(offset)
}

// Count records
export const count = (conditions) => {
  return db.count("* as count").from(TABLE_NAME).where(conditions).first()
}

// Update records
export const update = (conditions, data) => {
  return db.update(data).from(TABLE_NAME).where(conditions).returning("*")
}

// Delete records
export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}
```

**Key patterns:**

- Always define a `TABLE_NAME` constant
- Use `returning("*")` for insert/update operations to get the affected rows
- Use `first()` for single record queries
- Keep functions focused on database operations only

#### Controllers (`src/controllers/`)

Controllers contain business logic, validate requests, and coordinate between models and responses.

**Example: `src/controllers/todos.js`**

```javascript
import joi from "joi"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as todoModel from "../models/todos.js"
import { v4 as uuidv4 } from "uuid"

export const createTodo = async (req, res, next) => {
  try {
    // 1. Validate request body
    const bodySchema = joi.object({
      title: joi.string().required(),
      description: joi.string().optional(),
      is_completed: joi.boolean().optional(),
    })

    const { error, value } = bodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    // 2. Extract values
    const userId = req.user.id
    const { title, description, is_completed } = value

    // 3. Call model
    const [todo] = await todoModel.create({
      id: uuidv4(),
      user_id: userId,
      title,
      description,
      is_completed,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // 4. Log success
    logger.info("Todo created successfully", {
      todoId: todo.id,
      userId: userId,
      title: title,
    })

    // 5. Send response
    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: todo,
      }),
    )
  } catch (error) {
    logger.error("Create todo error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    })
    return next(error)
  }
}
```

**Key patterns:**

- Always use try-catch and pass errors to `next()`
- Validate input first with Joi schemas
- Use `HttpError` for known error conditions
- Use `apiResponse` for consistent response format
- Access authenticated user via `req.user.id` (when using `requireAccessToken`)
- Use `logger` for important events (user actions, errors, etc.)

#### Routes (`src/routes/`)

Routes define URL endpoints and map them to controller functions.

**Example: `src/routes/todos.js`**

```javascript
import { Router } from "express"
import * as todoController from "../controllers/todos.js"

const router = Router()

router
  .route("/")
  .get(todoController.getTodos)
  .post(todoController.createTodo)
  .delete(todoController.deleteTodos)

router
  .route("/:todo_id")
  .get(todoController.requireTodoIdParam, todoController.getTodo)
  .put(todoController.requireTodoIdParam, todoController.updateTodo)
  .delete(todoController.requireTodoIdParam, todoController.deleteTodo)

export default router
```

**Register routes in `src/routes/index.js`:**

```javascript
import { Router } from "express"
import { requireAccessToken } from "../middlewares/authorization.js"
import todosRoutes from "./todos.js"

const router = Router()

// Apply authentication middleware to all todo routes
router.use("/todos", requireAccessToken, todosRoutes)

export default router
```

**Key patterns:**

- Use `Router()` to create route modules
- Use `.route()` for DRY code on same path
- Apply middleware before controller functions
- Export the router and import in `routes/index.js`

### Middleware Stack

#### Authorization Middleware (`src/middlewares/authorization.js`)

Protects routes by verifying JWT tokens.

**`requireAccessToken`** - For protected routes:

```javascript
import { requireAccessToken } from "../middlewares/authorization.js"

router.use("/todos", requireAccessToken, todosRoutes)
```

After successful verification, `req.user.id` contains the user's ID.

**`requireRefreshToken`** - For token refresh endpoint:

```javascript
import { requireRefreshToken } from "../middlewares/authorization.js"

router.post("/refresh", requireRefreshToken, authController.refreshAccessToken)
```

#### Error Handling (`src/middlewares/error.js`)

Centralized error handling that catches all errors and returns consistent responses.

Always load this **last** in `src/index.js`:

```javascript
import { errorHandler, notFoundHandler } from "./middlewares/error.js"

app.use(notFoundHandler) // 404 handler
app.use(errorHandler) // Must be last
```

#### Security Middleware

**Helmet** - Security HTTP headers (configured in `src/index.js`):

```javascript
import helmet from "helmet"
app.use(helmet())
```

**CORS** - Cross-origin resource sharing:

```javascript
import cors from "cors"
app.use(cors())
```

#### Logging Middleware (`src/middlewares/logger.js`)

HTTP request logging using Morgan and custom middleware:

```javascript
import { httpLogger, requestLogger } from "./middlewares/logger.js"

// Morgan-based HTTP logger (logs all HTTP requests)
app.use(httpLogger)

// Custom request logger (logs request/response details with timing)
app.use(requestLogger)
```

**Features:**

- `httpLogger`: Morgan middleware that logs HTTP method, URL, status, response time
- `requestLogger`: Custom middleware that logs detailed request/response information

### Utilities Explained

#### `src/utils/logger.js` - Winston Logger

Comprehensive logging utility using Winston with daily log rotation:

```javascript
import logger from "../utils/logger.js"

// Log at different levels
logger.error("Error message", { errorDetails: "..." })
logger.warn("Warning message")
logger.info("Info message", { userId: "123", action: "login" })
logger.http("HTTP request", { method: "GET", url: "/api/todos" })
logger.debug("Debug message", { data: "..." })
```

**Features:**

- Daily log rotation (keeps 14 days)
- Separate error and combined log files
- Console output with colors (development)
- JSON format for file logs
- Configurable log level via `LOG_LEVEL` environment variable

**Best practices:**

- Use appropriate log levels (error for errors, info for important events, etc.)
- Include relevant context in metadata (userId, action, etc.)
- Log security events (authentication failures, unauthorized access)
- Avoid logging sensitive data (passwords, tokens, PII)

#### `src/utils/jwt.js` - JWT Token Management

```javascript
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js"

// Generate tokens
const accessToken = generateAccessToken(userId)
const refreshToken = generateRefreshToken(userId)
```

**Access Token:**

- Short-lived (15 minutes by default)
- Used for API requests
- Sent in `x-access-token` header

**Refresh Token:**

- Long-lived (7 days by default)
- Used to get new access tokens
- Sent in `x-refresh-token` header

#### `src/utils/argon2.js` - Password Hashing

```javascript
import { hashPassword, verifyPassword } from "../utils/argon2.js"

// Hash a password (for signup)
const hashedPassword = await hashPassword(plainPassword)

// Verify a password (for signin)
const isValid = await verifyPassword(hashedPassword, plainPassword)
```

#### `src/utils/response.js` - Response Formatter

```javascript
import apiResponse from "../utils/response.js"

// Success response
res.json(
  apiResponse({
    message: "OK",
    data: { id: 1, title: "Example" },
  }),
)

// Response without data
res.json(apiResponse({ message: "OK" }))
```

#### `src/utils/http-error.js` - Custom Error Class

```javascript
import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"

// Throw HTTP errors
throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Todo not found")
throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid credentials")
```

#### `src/utils/constant.js` - HTTP Constants

```javascript
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"

// Status codes
HTTP_STATUS_CODE.OK // 200
HTTP_STATUS_CODE.CREATED // 201
HTTP_STATUS_CODE.BAD_REQUEST // 400
HTTP_STATUS_CODE.UNAUTHORIZED // 401
HTTP_STATUS_CODE.NOT_FOUND // 404

// Status messages
HTTP_STATUS_MESSAGE.OK
HTTP_STATUS_MESSAGE.CREATED
// etc.
```

## Adding a New Feature: Step-by-Step Tutorial

Let's walk through adding a **Categories** feature to the todos API. This will allow users to categorize their todos.

### Step 1: Plan the Feature

**Data Model:**

- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to users)
- `name` (string, required)
- `color` (string, optional - hex color)
- `created_at`, `updated_at` (timestamps)

**API Endpoints:**

- `GET /api/categories` - List all categories
- `POST /api/categories` - Create a category
- `GET /api/categories/:category_id` - Get single category
- `PUT /api/categories/:category_id` - Update a category
- `DELETE /api/categories/:category_id` - Delete a category

**Authentication:** All endpoints require access token (user-specific categories)

### Step 2: Create Database Migration

```bash
npm run migrate:make create_categories_table
```

**Edit the generated migration file (`database/migrations/YYYYMMDDHHMMSS_create_categories_table.js`):**

```javascript
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.createTable("categories", (table) => {
    table.uuid("id").primary()
    table.uuid("user_id").notNullable()
    table.string("name").notNullable()
    table.string("color").nullable()
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE")
    table.timestamps(true, true)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("categories")
}
```

**Run the migration:**

```bash
npm run migrate
```

### Step 3: Create the Model

Create `src/models/categories.js`:

```javascript
import db from "../config/database.js"

const TABLE_NAME = "categories"

export const create = (category) => {
  return db.insert(category).into(TABLE_NAME).returning("*")
}

export const findOne = (conditions) => {
  return db.select("*").from(TABLE_NAME).where(conditions).first()
}

export const findMany = (conditions, orders = null) => {
  let query = db.select("*").from(TABLE_NAME).where(conditions)
  if (orders) {
    query = query.orderBy(orders)
  }
  return query
}

export const count = (conditions) => {
  return db.count("* as count").from(TABLE_NAME).where(conditions).first()
}

export const update = (conditions, category) => {
  return db.update(category).from(TABLE_NAME).where(conditions).returning("*")
}

export const remove = (conditions) => {
  return db.delete().from(TABLE_NAME).where(conditions)
}
```

### Step 4: Create the Controller

Create `src/controllers/categories.js`:

```javascript
import joi from "joi"
import HttpError from "../utils/http-error.js"
import apiResponse from "../utils/response.js"
import { HTTP_STATUS_CODE, HTTP_STATUS_MESSAGE } from "../utils/constant.js"
import * as categoryModel from "../models/categories.js"
import { v4 as uuidv4 } from "uuid"
import logger from "../utils/logger.js"

// Middleware to validate category_id parameter
export const requireCategoryIdParam = (req, res, next) => {
  const paramSchema = joi.object({
    category_id: joi.string().required(),
  })

  const { error, value } = paramSchema.validate(req.params)
  if (error) {
    throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
  }

  req.categoryId = value.category_id
  next()
}

// Get all categories for the authenticated user
export const getCategories = async (req, res, next) => {
  try {
    const userId = req.user.id
    const categories = await categoryModel.findMany({ user_id: userId }, [
      { column: "created_at", order: "desc" },
    ])

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: categories,
      }),
    )
  } catch (error) {
    logger.error("Get categories error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    })
    return next(error)
  }
}

// Get a single category
export const getCategory = async (req, res, next) => {
  try {
    const userId = req.user.id
    const categoryId = req.categoryId

    const category = await categoryModel.findOne({
      id: categoryId,
      user_id: userId,
    })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: category,
      }),
    )
  } catch (error) {
    logger.error("Get category error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      categoryId: req.categoryId,
    })
    return next(error)
  }
}

// Create a new category
export const createCategory = async (req, res, next) => {
  try {
    const bodySchema = joi.object({
      name: joi.string().required(),
      color: joi.string().optional(),
    })

    const { error, value } = bodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const userId = req.user.id
    const { name, color } = value

    const [category] = await categoryModel.create({
      id: uuidv4(),
      user_id: userId,
      name,
      color,
      created_at: new Date(),
      updated_at: new Date(),
    })

    logger.info("Category created successfully", {
      categoryId: category.id,
      userId: userId,
      name: name,
    })

    return res.status(HTTP_STATUS_CODE.CREATED).json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.CREATED,
        data: category,
      }),
    )
  } catch (error) {
    logger.error("Create category error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    })
    return next(error)
  }
}

// Update a category
export const updateCategory = async (req, res, next) => {
  try {
    const bodySchema = joi.object({
      name: joi.string().required(),
      color: joi.string().optional(),
    })

    const { error, value } = bodySchema.validate(req.body)
    if (error) {
      throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
    }

    const userId = req.user.id
    const categoryId = req.categoryId
    const { name, color } = value

    const [category] = await categoryModel.update(
      { id: categoryId, user_id: userId },
      {
        name,
        color,
        updated_at: new Date(),
      },
    )

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
        data: category,
      }),
    )
  } catch (error) {
    logger.error("Update category error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      categoryId: req.categoryId,
    })
    return next(error)
  }
}

// Delete a category
export const deleteCategory = async (req, res, next) => {
  try {
    const userId = req.user.id
    const categoryId = req.categoryId

    await categoryModel.remove({ id: categoryId, user_id: userId })

    return res.json(
      apiResponse({
        message: HTTP_STATUS_MESSAGE.OK,
      }),
    )
  } catch (error) {
    logger.error("Delete category error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      categoryId: req.categoryId,
    })
    return next(error)
  }
}
```

### Step 5: Create the Routes

Create `src/routes/categories.js`:

```javascript
import { Router } from "express"
import * as categoryController from "../controllers/categories.js"

const router = Router()

router.route("/").get(categoryController.getCategories).post(categoryController.createCategory)

router
  .route("/:category_id")
  .get(categoryController.requireCategoryIdParam, categoryController.getCategory)
  .put(categoryController.requireCategoryIdParam, categoryController.updateCategory)
  .delete(categoryController.requireCategoryIdParam, categoryController.deleteCategory)

export default router
```

### Step 6: Register the Routes

Edit `src/routes/index.js`:

```javascript
import { Router } from "express"
import { requireAccessToken } from "../middlewares/authorization.js"
import authRoutes from "./authentication.js"
import todosRoutes from "./todos.js"
import categoriesRoutes from "./categories.js" // Add this

const router = Router()

router.use("/auth", authRoutes)
router.use("/todos", requireAccessToken, todosRoutes)
router.use("/categories", requireAccessToken, categoriesRoutes) // Add this

export default router
```

### Step 7: Test the Feature

Start the development server:

```bash
npm run dev
```

**Test with cURL:**

```bash
# 1. Sign in to get tokens
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"yourusername","password":"yourpassword"}'

# 2. Create a category (replace ACCESS_TOKEN)
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "x-access-token: YOUR_ACCESS_TOKEN" \
  -d '{"name":"Work","color":"#3B82F6"}'

# 3. Get all categories
curl http://localhost:3000/api/categories \
  -H "x-access-token: YOUR_ACCESS_TOKEN"

# 4. Update a category (replace CATEGORY_ID)
curl -X PUT http://localhost:3000/api/categories/CATEGORY_ID \
  -H "Content-Type: application/json" \
  -H "x-access-token: YOUR_ACCESS_TOKEN" \
  -d '{"name":"Personal","color":"#10B981"}'

# 5. Delete a category
curl -X DELETE http://localhost:3000/api/categories/CATEGORY_ID \
  -H "x-access-token: YOUR_ACCESS_TOKEN"
```

## Database Management

### Creating Migrations

```bash
npm run migrate:make <descriptive_name>
```

**Best practices:**

- Use descriptive, snake_case names (e.g., `create_users_table`, `add_email_to_users`)
- Always provide both `up` and `down` functions
- Test rollbacks: `npm run migrate:rollback`
- Use transactions for complex changes

### Running Migrations

```bash
npm run migrate              # Run all pending migrations
npm run migrate:rollback     # Rollback the last migration
```

### Creating Seeds

```bash
npm run seed:make <name>
```

**Example seed file:**

```javascript
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const seed = async (knex) => {
  // Clears existing entries
  await knex("categories").del()

  // Inserts seed entries
  await knex("categories").insert([
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      user_id: "some-user-id",
      name: "Work",
      color: "#3B82F6",
      created_at: new Date(),
      updated_at: new Date(),
    },
  ])
}
```

**Run seeds:**

```bash
npm run seed
```

## Authentication & Authorization

### Authentication Flow

1. **Signup** (`POST /api/auth/signup`)
   - User provides username and password
   - Password is hashed with Argon2
   - User record is created

2. **Signin** (`POST /api/auth/signin`)
   - User provides credentials
   - Password is verified
   - Access token (15min) and refresh token (7d) are returned

3. **Access Protected Routes**
   - Include access token in `x-access-token` header
   - `requireAccessToken` middleware verifies the token
   - `req.user.id` contains the authenticated user's ID

4. **Refresh Token** (`POST /api/auth/refresh`)
   - Include refresh token in `x-refresh-token` header
   - Returns a new access token

### Adding Protected Routes

Apply the `requireAccessToken` middleware to routes that need authentication:

```javascript
import { requireAccessToken } from "../middlewares/authorization.js"

router.use("/categories", requireAccessToken, categoriesRoutes)
```

Access the authenticated user in controllers:

```javascript
const userId = req.user.id // The user's UUID
```

## Input Validation

Use Joi schemas to validate input at the beginning of controller functions.

### Request Body Validation

```javascript
const bodySchema = joi.object({
  title: joi.string().min(3).max(100).required(),
  description: joi.string().max(500).optional(),
  is_completed: joi.boolean().optional(),
})

const { error, value } = bodySchema.validate(req.body)
if (error) {
  throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, error.details[0].message)
}
// Use `value` for validated data
const { title, description, is_completed } = value
```

### Query Parameter Validation

```javascript
const querySchema = joi.object({
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(100).default(10),
  sort_by: joi.string().valid("name", "created_at").default("created_at"),
})

const { error, value } = querySchema.validate(req.query)
```

### Path Parameter Validation

```javascript
const paramSchema = joi.object({
  category_id: joi.string().required(),
})

const { error, value } = paramSchema.validate(req.params)
```

## Error Handling

### Throwing Errors

Use the `HttpError` class for HTTP errors:

```javascript
import HttpError from "../utils/http-error.js"
import { HTTP_STATUS_CODE } from "../utils/constant.js"

// Bad request (validation errors)
throw new HttpError(HTTP_STATUS_CODE.BAD_REQUEST, "Invalid input")

// Unauthorized (authentication failed)
throw new HttpError(HTTP_STATUS_CODE.UNAUTHORIZED, "Invalid credentials")

// Not found
throw new HttpError(HTTP_STATUS_CODE.NOT_FOUND, "Resource not found")
```

### Error Response Format

All errors follow this format:

```json
{
  "message": "Error description",
  "data": null
}
```

### Controller Error Handling Pattern

Always wrap controller logic in try-catch:

```javascript
import logger from "../utils/logger.js"

export const myController = async (req, res, next) => {
  try {
    // Controller logic here
  } catch (error) {
    logger.error("Error in myController", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    })
    return next(error) // Pass to error middleware
  }
}
```

## API Response Format

All successful responses follow this format:

```javascript
import apiResponse from "../utils/response.js"

// Response with data
res.json(
  apiResponse({
    message: "OK",
    data: { id: 1, title: "Example" },
  }),
)

// Response without data
res.json(apiResponse({ message: "OK" }))
```

**Single resource response:**

```json
{
  "message": "OK",
  "data": {
    "id": 1,
    "title": "Example"
  }
}
```

**Paginated response:**

```json
{
  "message": "OK",
  "data": [
    { "id": 1, "title": "First" },
    { "id": 2, "title": "Second" }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 50,
    "items_per_page": 10,
    "has_next_page": true,
    "has_previous_page": false,
    "next_page": 2,
    "previous_page": null
  }
}
```

## Common Patterns and Recipes

### Pagination

Used in `getTodos` controller:

```javascript
const querySchema = joi.object({
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(100).default(10),
})

const { page, limit } = value
const offset = (page - 1) * limit

// Get count and data simultaneously
const [totalResult, items] = await Promise.all([
  model.count({ user_id: userId }),
  model.findManyPaginated({ user_id: userId }, { limit, offset }),
])

// Build pagination metadata
const total = parseInt(totalResult.count)
const totalPages = Math.ceil(total / limit)
const pagination = {
  current_page: page,
  total_pages: totalPages,
  total_items: total,
  items_per_page: limit,
  has_next_page: page < totalPages,
  has_previous_page: page > 1,
  next_page: page < totalPages ? page + 1 : null,
  previous_page: page > 1 ? page - 1 : null,
}
```

### Sorting

```javascript
const { sort_by, sort_order } = value

// Single column sort
model.findMany({}, [{ column: sort_by, order: sort_order }])

// Multiple column sort
model.findMany({}, [
  { column: "priority", order: "desc" },
  { column: "created_at", order: "desc" },
])
```

### Filtering

```javascript
// Build dynamic conditions
const conditions = { user_id: userId }

if (status) {
  conditions.status = status
}

if (search) {
  // For LIKE queries, use Knex's where builder
  return db.select("*").from(TABLE_NAME).where(conditions).andWhere("name", "like", `%${search}%`)
}
```

### Foreign Key Relationships

**In migrations:**

```javascript
table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE") // Delete related records when user is deleted
```

**Querying related data:**

```javascript
// Join with users table
db.select("todos.*", "users.username")
  .from("todos")
  .join("users", "todos.user_id", "users.id")
  .where("todos.user_id", userId)
```

## Production Considerations

### Security

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong, random JWT secrets (32+ characters)
   - Use different secrets for development and production

2. **Database**
   - Use connection pooling (configured in `knexfile.js`)
   - Restrict database user privileges
   - Enable SSL for production connections

3. **API Security**
   - Enable rate limiting for public endpoints
   - Validate and sanitize all input
   - Use HTTPS in production
   - Keep dependencies updated: `npm audit`

### Performance

1. **Database Indexes**

   ```javascript
   // In migrations
   table.index("user_id") // Index foreign keys
   table.index(["user_id", "status"]) // Composite index
   ```

2. **Query Optimization**
   - Select only needed columns
   - Use `limit()` for large result sets
   - Avoid N+1 queries with joins

3. **Connection Pooling**
   ```javascript
   // knexfile.js
   pool: {
     min: 2,
     max: 10,
   }
   ```

## Troubleshooting

### Common Issues

**"No token provided"**

- Ensure `x-access-token` header is set
- Check header name (not `Authorization`)

**"Token expired"**

- Access tokens expire after 15 minutes
- Use refresh token to get new access token

**"Invalid token"**

- Verify token is correctly copied
- Check JWT secrets match between generation and verification

**Database connection errors**

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database credentials and permissions

**ES Module import errors**

- Ensure file extensions are included (`.js`)
- Use `import` not `require`
- Check `package.json` has `"type": "module"`

### Debugging Tips

1. **Check the error handler**
   - Errors are logged by `errorHandler` middleware
   - Check console for stack traces

2. **Verify middleware order**
   - Security middleware (helmet, cors) should be first
   - Error middleware must be last

3. **Test database queries**
   - Use `console.log` to inspect query results
   - Test SQL directly in PostgreSQL

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Knex.js Documentation](https://knexjs.org/)
- [Joi Validation](https://joi.dev/api/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Argon2 Hashing](https://github.com/ranisalt/node-argon2)

---

**See README.md** for quick start and setup instructions.

**See CLAUDE.md** for quick reference of commands and patterns.

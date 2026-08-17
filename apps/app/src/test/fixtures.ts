/**
 * Typed response fixtures for the spec suite.
 *
 * `vi.mocked()` collapses the http client's envelope generic to `unknown`, so a partial payload
 * literal compiles even when it no longer matches its contract. Building payloads here — where the
 * return type is the contract — is what restores that check. Every factory returns `Wire<T>`, not
 * the bare entity: responses are JSON, so `Date` fields arrive as ISO strings.
 */
import type {
  AuditLog,
  Envelope,
  Invitation,
  InvitationListItem,
  InvitationPreview,
  InvitationWithToken,
  MyInvitation,
  Org,
  OrgMember,
  PaginatedEnvelope,
  PaginationMeta,
  Permission,
  Project,
  ProjectMember,
  Role,
  Todo,
  User,
  Wire,
} from "@fullstack/contracts"
import type { HttpResult } from "@/utils/http"

/** One frozen instant, so fixture comparisons never depend on the clock. */
export const AT = "2026-01-01T00:00:00.000Z"

export function makeUser(o: Partial<Wire<User>> = {}): Wire<User> {
  return { id: "u1", name: "Ada Lovelace", email: "ada@example.com", ...o }
}

export function makeOrg(o: Partial<Wire<Org>> = {}): Wire<Org> {
  return {
    id: "o1",
    name: "Acme",
    description: null,
    created_by: "u1",
    created_at: AT,
    updated_at: AT,
    ...o,
  }
}

export function makeProject(o: Partial<Wire<Project>> = {}): Wire<Project> {
  return {
    id: "p1",
    org_id: "o1",
    name: "Apollo",
    description: null,
    created_by: "u1",
    created_at: AT,
    updated_at: AT,
    ...o,
  }
}

export function makeTodo(o: Partial<Wire<Todo>> = {}): Wire<Todo> {
  return {
    id: "t1",
    project_id: "p1",
    user_id: "u1",
    title: "Write the spec",
    description: null,
    is_completed: false,
    created_at: AT,
    updated_at: AT,
    ...o,
  }
}

export function makePermission(o: Partial<Wire<Permission>> = {}): Wire<Permission> {
  return {
    id: "perm1",
    name: "todos:read",
    resource: "todos",
    action: "read",
    description: null,
    ...o,
  }
}

export function makeRole(o: Partial<Wire<Role>> = {}): Wire<Role> {
  return {
    id: "r1",
    org_id: "o1",
    name: "Admin",
    description: null,
    is_system: false,
    created_at: AT,
    updated_at: AT,
    permissions: [],
    ...o,
  }
}

export function makeOrgMember(o: Partial<Wire<OrgMember>> = {}): Wire<OrgMember> {
  return {
    user_id: "u1",
    org_id: "o1",
    role_id: "r1",
    joined_at: AT,
    name: "Ada Lovelace",
    email: "ada@example.com",
    role_name: "admin",
    ...o,
  }
}

export function makeProjectMember(o: Partial<Wire<ProjectMember>> = {}): Wire<ProjectMember> {
  return {
    user_id: "u1",
    project_id: "p1",
    role_id: "r1",
    joined_at: AT,
    name: "Ada Lovelace",
    email: "ada@example.com",
    role_name: "member",
    ...o,
  }
}

export function makeAuditLog(o: Partial<Wire<AuditLog>> = {}): Wire<AuditLog> {
  return {
    id: "log-1",
    org_id: "org-1",
    project_id: null,
    actor_id: "user-1",
    actor_name: "Ada Lovelace",
    actor_email: "ada@example.com",
    action: "todo.created",
    entity_type: "todo",
    entity_id: "todo-1",
    entity_name: "Write the spec",
    changes: null,
    created_at: AT,
    ...o,
  }
}

/** Not a `Wire<T>`: `PaginationMeta` holds only numbers and nulls, so serialization is identity. */
export function makePaginationMeta(o: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 10,
    has_next_page: false,
    has_previous_page: false,
    next_page: null,
    previous_page: null,
    ...o,
  }
}

export function makeInvitation(o: Partial<Wire<Invitation>> = {}): Wire<Invitation> {
  return {
    id: "inv1",
    org_id: "o1",
    project_id: null,
    inviter_id: "u1",
    invitee_email: "grace@example.com",
    invitee_id: null,
    role_id: "r1",
    // A plain string, matching the contract: the Prisma column carries no
    // database-level constraint, so a union here would claim an invariant
    // the schema does not enforce.
    status: "pending",
    expires_at: AT,
    created_at: AT,
    updated_at: AT,
    ...o,
  }
}

/** 64 hex chars, matching the real token: `AcceptInvitationDto` rejects any other length. */
const TOKEN = "a".repeat(64)

export function makeInvitationWithToken(
  o: Partial<Wire<InvitationWithToken>> = {},
): Wire<InvitationWithToken> {
  return {
    ...makeInvitation(),
    token: TOKEN,
    accept_url: `https://app.example.com/invite/inv1?token=${TOKEN}`,
    ...o,
  }
}

export function makeInvitationListItem(
  o: Partial<Wire<InvitationListItem>> = {},
): Wire<InvitationListItem> {
  return {
    ...makeInvitation(),
    inviter_name: "Ada Lovelace",
    invitee_name: null,
    role_name: "member",
    ...o,
  }
}

export function makeMyInvitation(o: Partial<Wire<MyInvitation>> = {}): Wire<MyInvitation> {
  return {
    ...makeInvitation(),
    org_name: "Acme",
    project_name: null,
    inviter_name: "Ada Lovelace",
    role_name: "member",
    ...o,
  }
}

/**
 * Deliberately NOT built from `makeInvitation`. `InvitationPreview` is the public, token-gated
 * projection: it omits `org_id`, `inviter_id` and `role_id` so a logged-out caller cannot see them.
 * Spreading the base here would hand specs fields the real endpoint never returns.
 */
export function makeInvitationPreview(
  o: Partial<Wire<InvitationPreview>> = {},
): Wire<InvitationPreview> {
  return {
    id: "inv1",
    org_name: "Acme",
    project_name: null,
    inviter_name: "Ada Lovelace",
    role_name: "member",
    invitee_email: "grace@example.com",
    status: "pending",
    expires_at: AT,
    is_expired: false,
    requires_signup: false,
    ...o,
  }
}

/**
 * Build a mocked success response.
 *
 * Two wrappers stack: `HttpResult` is the axios-shaped `{ data, status }` the client returns, and
 * the server envelope is `{ message, data }` — so a payload lives at `response.data.data`. `status`
 * is supplied here because `vi.mocked()` collapses the envelope generic to `unknown`, which makes
 * the field mandatory at every call site with an error that does not name the cause.
 */
export function ok<T>(data: T): HttpResult<Envelope<T>> {
  return { data: { message: "OK", data }, status: 200 }
}

/**
 * Build a mocked paginated response. `PaginatedEnvelope` requires `pagination` — it is never
 * optional there — which is why this is a separate helper rather than an argument to `ok`.
 */
export function okPaginated<T>(
  data: T[],
  pagination: Partial<PaginationMeta> = {},
): HttpResult<PaginatedEnvelope<T[]>> {
  return {
    data: {
      message: "OK",
      data,
      pagination: makePaginationMeta({ total_items: data.length, ...pagination }),
    },
    status: 200,
  }
}

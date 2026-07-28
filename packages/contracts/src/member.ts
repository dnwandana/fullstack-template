/**
 * Membership rows. Like `User`, these are assembled inline in the API's `members.service` with no
 * response class, so they are NOT drift-protected.
 * TODO(ts-migration): bind via `implements` once the API grows member response DTOs.
 */
export type OrgMember = {
  user_id: string
  org_id: string
  role_id: string
  joined_at: Date
  name: string
  email: string
  role_name: string
}

export type ProjectMember = {
  user_id: string
  project_id: string
  role_id: string
  joined_at: Date
  name: string
  email: string
  role_name: string
}

/**
 * The user shape auth endpoints return. Not bound to an API response class: `apps/api` builds
 * these inline from a private `SafeUser` alias, so this type is NOT drift-protected.
 * TODO(ts-migration): bind via `implements` once the API grows an auth response DTO.
 */
export type User = {
  id: string
  name: string
  email: string
}

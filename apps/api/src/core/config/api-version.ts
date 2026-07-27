/**
 * Source of truth for the version prefix: the Nest router and both cookie paths below derive
 * from it. nginx cannot import TypeScript, so nginx/templates/api.conf.template mirrors those
 * two paths by hand and must be changed together with this file.
 */
export const API_PREFIX = "api"
export const API_VERSION = "1"

/**
 * Cookie paths match by whole path segments, so "/api/auth" does NOT cover
 * "/api/v1/auth/refresh". Bumping API_VERSION without moving these — on both sides — logs every
 * user out at their next refresh, with no error raised anywhere.
 */
export const ACCESS_COOKIE_PATH = `/${API_PREFIX}/v${API_VERSION}`
export const REFRESH_COOKIE_PATH = `${ACCESS_COOKIE_PATH}/auth`

// The version prefix is spelled in four places that must agree: the Nest router,
// the two auth cookie paths, and the edge nginx cookie-path rewrite. The first
// three derive from here. nginx cannot import TypeScript, so its rules mirror
// ACCESS_COOKIE_PATH and REFRESH_COOKIE_PATH by hand — see nginx/templates/
// api.conf.template, which carries the matching comment.
export const API_PREFIX = "api"
export const API_VERSION = "1"

// Cookie paths match by whole path segments, so "/api/auth" does NOT cover
// "/api/v1/auth/refresh". Bumping API_VERSION without moving these logs every
// user out at their next refresh, with no error anywhere.
export const ACCESS_COOKIE_PATH = `/${API_PREFIX}/v${API_VERSION}`
export const REFRESH_COOKIE_PATH = `${ACCESS_COOKIE_PATH}/auth`

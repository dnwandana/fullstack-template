/**
 * Authentication API service
 * Handles signup, signin, and token refresh
 */

import { request, baseURL } from "@/utils/http"

/**
 * Register a new user account
 * @param {string} name - Display name (1-100 characters)
 * @param {string} email - Email address (login identifier)
 * @param {string} password - Password (min 8 characters)
 * @param {string} confirmation_password - Password confirmation (must match password)
 * @returns {Promise} API response with user data
 */
export function signup(name, email, password, confirmation_password) {
  return request.post("/auth/signup", { name, email, password, confirmation_password })
}

/**
 * Sign in with credentials
 * @param {string} email - Email address
 * @param {string} password - Password
 * @returns {Promise} API response with user data and tokens
 */
export function signin(email, password) {
  return request.post("/auth/signin", { email, password })
}

/**
 * Refresh access token using httpOnly cookie.
 * Uses raw fetch (not request()) to avoid infinite recursion
 * if the refresh endpoint itself returns 401.
 * @returns {Promise} API response with new access token
 */
export function refreshToken() {
  return fetch(`${baseURL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.message || "Token refresh failed")
    }
    const data = await res.json()
    return { data, status: res.status }
  })
}

/**
 * Logout — revokes the refresh token server-side
 * @returns {Promise} API response
 */
export function logout() {
  return fetch(`${baseURL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      return { data: null, status: res.status }
    }
    const data = await res.json()
    return { data, status: res.status }
  })
}

/**
 * Get current authenticated user (verifies cookie validity)
 * @returns {Promise} API response with user data { id, name, email }
 */
export function getMe() {
  return request.get("/auth/me")
}

/**
 * Authentication API service
 * Handles signup, signin, and token refresh
 */

import { request, baseURL } from "@/utils/http"

/**
 * Register a new user account
 * @param {string} username - Username (min 5 characters)
 * @param {string} password - Password (min 8 characters)
 * @param {string} confirmation_password - Password confirmation (must match password)
 * @returns {Promise} API response with user data
 */
export function signup(username, password, confirmation_password) {
  return request.post("/auth/signup", { username, password, confirmation_password })
}

/**
 * Sign in with credentials
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise} API response with user data and tokens
 */
export function signin(username, password) {
  return request.post("/auth/signin", { username, password })
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

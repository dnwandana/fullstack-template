/**
 * Authentication API service
 * Handles signup, signin, and token refresh
 */

import type { Envelope, ErrorEnvelope, User, Wire } from "@fullstack/contracts"
import { request, baseURL, type HttpResult } from "@/utils/http"

/**
 * Register a new user account.
 * `name` is a display name (1-100 characters), `email` is the login identifier,
 * `password` is at least 8 characters and `confirmation_password` must match it.
 */
export function signup(
  name: string,
  email: string,
  password: string,
  confirmation_password: string,
): Promise<HttpResult<Envelope<Wire<User>>>> {
  return request.post<Envelope<Wire<User>>>("/auth/signup", {
    name,
    email,
    password,
    confirmation_password,
  })
}

/**
 * Sign in with credentials
 */
export function signin(email: string, password: string): Promise<HttpResult<Envelope<Wire<User>>>> {
  return request.post<Envelope<Wire<User>>>("/auth/signin", { email, password })
}

/**
 * Refresh access token using httpOnly cookie.
 * Uses raw fetch (not request()) to avoid infinite recursion
 * if the refresh endpoint itself returns 401.
 */
export function refreshToken(): Promise<HttpResult<Envelope<null>>> {
  return fetch(`${baseURL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      const errorData: Partial<ErrorEnvelope> = await res.json().catch(() => ({}))
      throw new Error(errorData.message || "Token refresh failed")
    }
    const data: Envelope<null> = await res.json()
    return { data, status: res.status }
  })
}

/**
 * Logout — revokes the refresh token server-side
 */
export function logout(): Promise<HttpResult<Envelope<null> | null>> {
  return fetch(`${baseURL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).then(async (res) => {
    if (!res.ok) {
      return { data: null, status: res.status }
    }
    const data: Envelope<null> = await res.json()
    return { data, status: res.status }
  })
}

/**
 * Get current authenticated user (verifies cookie validity)
 */
export function getMe(): Promise<HttpResult<Envelope<Wire<User>>>> {
  return request.get<Envelope<Wire<User>>>("/auth/me")
}

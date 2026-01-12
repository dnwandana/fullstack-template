/**
 * Authentication API service
 * Handles signup, signin, and token refresh
 */

import request from '@/utils/request'
import { getRefreshToken } from '@/utils/storage'

/**
 * Register a new user account
 * @param {string} username - Username (min 5 characters)
 * @param {string} password - Password (min 8 characters)
 * @returns {Promise} API response with user data
 */
export function signup(username, password) {
  return request.post('/auth/signup', { username, password })
}

/**
 * Sign in with credentials
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise} API response with user data and tokens
 */
export function signin(username, password) {
  return request.post('/auth/signin', { username, password })
}

/**
 * Refresh access token using refresh token
 * @returns {Promise} API response with new access token
 */
export function refreshToken() {
  const token = getRefreshToken()
  return request.post(
    '/auth/refresh',
    {},
    {
      headers: {
        'x-refresh-token': token,
      },
    },
  )
}

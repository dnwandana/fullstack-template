/**
 * Token and user data storage utilities
 * Handles localStorage operations for authentication
 */

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_DATA_KEY = 'user_data'

// Token management
export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// User data management
export function getUserData() {
  const data = localStorage.getItem(USER_DATA_KEY)
  return data ? JSON.parse(data) : null
}

export function setUserData(user) {
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user))
}

export function clearUserData() {
  localStorage.removeItem(USER_DATA_KEY)
}

// Clear all auth data
export function clearAuthData() {
  clearTokens()
  clearUserData()
}

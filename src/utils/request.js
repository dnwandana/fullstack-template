/**
 * Axios instance with interceptors for authentication
 * Handles token attachment and automatic refresh on 401
 */

import axios from 'axios'
import { message } from 'ant-design-vue'
import { getAccessToken, getRefreshToken, setTokens, clearAuthData } from './storage'

// Create axios instance with base URL from environment
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Flag to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue = []

// Process queued requests after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Request interceptor - attach access token
request.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) {
      config.headers['x-access-token'] = token
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor - handle errors and token refresh
request.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry for auth endpoints
      if (
        originalRequest.url?.includes('/auth/signin') ||
        originalRequest.url?.includes('/auth/signup') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error)
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['x-access-token'] = token
            return request(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()

      if (!refreshToken) {
        isRefreshing = false
        clearAuthData()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        // Call refresh endpoint
        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              'x-refresh-token': refreshToken,
            },
          },
        )

        const newAccessToken = response.data.data.access_token
        setTokens(newAccessToken, refreshToken)

        processQueue(null, newAccessToken)

        // Retry original request with new token
        originalRequest.headers['x-access-token'] = newAccessToken
        return request(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearAuthData()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred'

    // Show error message for non-401 errors
    if (error.response?.status !== 401) {
      message.error(errorMessage)
    }

    return Promise.reject(error)
  },
)

export default request

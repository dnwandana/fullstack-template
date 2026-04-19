import { message } from "ant-design-vue"
import { clearUserData } from "./storage"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"

const DEFAULT_TIMEOUT = 10000

// Auth endpoints that must never trigger the refresh-retry logic
const NO_RETRY_ENDPOINTS = ["/auth/signin", "/auth/signup", "/auth/refresh"]

// ---------------------------------------------------------------------------
// HttpError — axios-compatible error shape
// ---------------------------------------------------------------------------

// Stores access `error.response?.data?.message` in catch blocks (see auth store).
// We attach a `response` property so existing store error handling works
// without any changes.
export class HttpError extends Error {
  constructor(status, data, messageText) {
    super(messageText)
    this.name = "HttpError"
    this.status = status
    this.data = data
    this.response = { data, status }
  }
}

// ---------------------------------------------------------------------------
// Token refresh queuing (mirrors the current axios interceptor)
// ---------------------------------------------------------------------------

let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

async function handleRefresh(originalOptions) {
  // If a refresh is already in flight, queue this request
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    }).then(() => {
      // Retry the original request after refresh succeeds
      return send(originalOptions.method, originalOptions.url, {
        ...originalOptions,
        _retry: true,
      })
    })
  }

  isRefreshing = true

  try {
    const response = await fetch(`${baseURL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new HttpError(response.status, errorData, errorData.message || "Refresh failed")
    }

    await response.json()
    processQueue(null, true)

    return send(originalOptions.method, originalOptions.url, {
      ...originalOptions,
      _retry: true,
    })
  } catch (error) {
    processQueue(error)
    clearUserData()
    window.location.href = "/login"
    throw error
  } finally {
    isRefreshing = false
  }
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

function buildURL(url, params) {
  let fullURL = `${baseURL}${url}`
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value)
    })
    fullURL += `?${searchParams.toString()}`
  }
  return fullURL
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

async function send(method, url, options = {}) {
  const {
    body,
    headers: customHeaders = {},
    params,
    timeout = DEFAULT_TIMEOUT,
    _retry = false,
  } = options

  // AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  const headers = { ...customHeaders }
  if (body) {
    headers["Content-Type"] = "application/json"
  }

  const fullURL = buildURL(url, params)

  try {
    const fetchOptions = { method, headers, signal: controller.signal }
    fetchOptions.credentials = "include"
    if (method !== "GET" && body) {
      fetchOptions.body = JSON.stringify(body)
    }
    const response = await fetch(fullURL, fetchOptions)

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || response.statusText || "An error occurred"

      // 401 handling — attempt token refresh (unless excluded endpoint or already retried)
      if (
        response.status === 401 &&
        !_retry &&
        !NO_RETRY_ENDPOINTS.some((ep) => url.includes(ep))
      ) {
        return handleRefresh({ method, url, body, headers: customHeaders, params, timeout })
      }

      // Show error toast for non-401 errors (matches current axios interceptor behavior)
      if (response.status !== 401) {
        message.error(errorMessage)
      }

      throw new HttpError(response.status, errorData, errorMessage)
    }

    // Return axios-compatible response shape: { data, status }
    // Stores access `response.data` and `response.data.data` — this preserves that.
    const data = await response.json()
    return { data, status: response.status }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error.name === "AbortError") {
      throw new HttpError(0, null, "Request timed out")
    }

    // Re-throw HttpError and other errors as-is
    throw error
  }
}

// ---------------------------------------------------------------------------
// Public API — convenience methods matching current axios usage patterns
// ---------------------------------------------------------------------------

export const request = {
  send,

  get(url, params) {
    return send("GET", url, { params })
  },

  post(url, body) {
    return send("POST", url, { body })
  },

  put(url, body) {
    return send("PUT", url, { body })
  },

  del(url, params) {
    return send("DELETE", url, { params })
  },
}

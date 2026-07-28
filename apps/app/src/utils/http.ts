import type { ErrorEnvelope } from "@fullstack/contracts"
import { message } from "ant-design-vue"
import { clearUserData } from "./storage"

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"

/** Query-string values. Everything is stringified by `buildURL`. */
export type QueryParams = Record<string, string | number | boolean | undefined>

export interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
  params?: QueryParams
  timeout?: number
  _retry?: boolean
}

/** The axios-shaped result `send` resolves to. `E` is the full envelope, not the payload. */
export interface HttpResult<E> {
  data: E
  status: number
}

interface OriginalOptions extends RequestOptions {
  method: HttpMethod
  url: string
}

interface QueuedRequest {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// The version lives here and only here. Every request URL is `${baseURL}${url}`,
// so prefixing call sites instead would break NO_RETRY_ENDPOINTS /
// NO_REDIRECT_ENDPOINTS below — those match the bare endpoint argument, and a
// missed NO_RETRY match turns a 401 on signin into a refresh/retry loop.
export const baseURL = `${import.meta.env.VITE_API_BASE_URL}/v1`

const DEFAULT_TIMEOUT = 10000

// Auth endpoints that must never trigger the refresh-retry logic
const NO_RETRY_ENDPOINTS = ["/auth/signin", "/auth/signup", "/auth/refresh"]

// Endpoints where a failed refresh must NOT force a hard redirect to /login.
// /auth/me is a session probe (called by initAuth on every navigation while
// logged out); its caller already handles the failure gracefully, and the
// router guard already redirects to /login — a hard reload here is redundant
// and, since it re-triggers the same probe on load, causes an infinite loop.
const NO_REDIRECT_ENDPOINTS = ["/auth/me"]

// Pages where we are already at (or on our way to) the login screen, so a hard
// redirect to /login would only reload the same page. Guarding against this
// breaks any refresh-failure reload loop regardless of which endpoint triggered
// it — a background 401 fired during app boot (before the router guard settles)
// can otherwise redirect -> reload -> re-fire -> redirect forever.
const AUTH_PATHS = ["/login", "/signup"]

// ---------------------------------------------------------------------------
// HttpError — axios-compatible error shape
// ---------------------------------------------------------------------------

// Stores access `error.response?.data?.message` in catch blocks (see auth store).
// We attach a `response` property so existing store error handling works
// without any changes.
export class HttpError extends Error {
  readonly status: number
  readonly data: Partial<ErrorEnvelope> | null
  readonly response: { data: Partial<ErrorEnvelope> | null; status: number }

  constructor(status: number, data: Partial<ErrorEnvelope> | null, messageText: string) {
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
let failedQueue: QueuedRequest[] = []

function processQueue(error: unknown, token: boolean | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

async function handleRefresh<E>(originalOptions: OriginalOptions): Promise<HttpResult<E>> {
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
      const errorData: Partial<ErrorEnvelope> = await response.json().catch(() => ({}))
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
    const skipRedirect =
      NO_REDIRECT_ENDPOINTS.some((ep) => originalOptions.url.includes(ep)) ||
      AUTH_PATHS.includes(window.location.pathname)
    if (!skipRedirect) {
      window.location.href = "/login"
    }
    throw error
  } finally {
    isRefreshing = false
  }
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

function buildURL(url: string, params?: QueryParams): string {
  let fullURL = `${baseURL}${url}`
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })
    fullURL += `?${searchParams.toString()}`
  }
  return fullURL
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

async function send<E>(
  method: HttpMethod,
  url: string,
  options: RequestOptions = {},
): Promise<HttpResult<E>> {
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
    const fetchOptions: RequestInit = { method, headers, signal: controller.signal }
    fetchOptions.credentials = "include"
    if (method !== "GET" && body) {
      fetchOptions.body = JSON.stringify(body)
    }
    const response = await fetch(fullURL, fetchOptions)

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData: Partial<ErrorEnvelope> = await response.json().catch(() => ({}))
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
    const data: E = await response.json()
    return { data, status: response.status }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === "AbortError") {
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

  get<E>(url: string, params?: QueryParams): Promise<HttpResult<E>> {
    return send<E>("GET", url, { params })
  },

  post<E>(url: string, body?: unknown): Promise<HttpResult<E>> {
    return send<E>("POST", url, { body })
  },

  put<E>(url: string, body?: unknown): Promise<HttpResult<E>> {
    return send<E>("PUT", url, { body })
  },

  del<E>(url: string, params?: QueryParams): Promise<HttpResult<E>> {
    return send<E>("DELETE", url, { params })
  },
}

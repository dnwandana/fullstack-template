/**
 * Auth store - manages authentication state
 */

import type { Envelope, User, Wire } from "@fullstack/contracts"
import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { message } from "ant-design-vue"
import {
  signup as apiSignup,
  signin as apiSignin,
  logout as apiLogout,
  getMe as apiGetMe,
} from "@/api/auth"
// A value import, not `import type`: the catch blocks below need the runtime
// class for `instanceof`.
import { HttpError } from "@/utils/http"
import { setUserData, clearUserData, type StoredUser } from "@/utils/storage"

export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref<StoredUser | null>(null)
  const loading = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const currentUser = computed(() => user.value)

  // Actions

  /**
   * Initialize auth state from localStorage
   * Called on app startup
   */
  async function initAuth(): Promise<void> {
    try {
      const response = await apiGetMe()
      const userData = response.data.data
      setUserData(userData)
      user.value = userData
    } catch {
      clearUserData()
      user.value = null
    }
  }

  /**
   * Register a new user
   */
  async function signup(
    name: string,
    email: string,
    password: string,
    confirmation_password: string,
  ): Promise<Envelope<Wire<User>>> {
    loading.value = true
    try {
      const response = await apiSignup(name, email, password, confirmation_password)
      message.success("Account created successfully! Please sign in.")
      return response.data
    } catch (error) {
      const errorMsg =
        (error instanceof HttpError ? error.response.data?.message : undefined) ||
        "Signup failed. Please try again."
      throw new Error(errorMsg, { cause: error })
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign in user with credentials
   */
  async function signin(email: string, password: string): Promise<Envelope<Wire<User>>> {
    loading.value = true
    try {
      const response = await apiSignin(email, password)
      const { id, name, email: userEmail } = response.data.data

      const userData = { id, name, email: userEmail }
      setUserData(userData)
      user.value = userData

      message.success("Signed in successfully!")
      return response.data
    } catch (error) {
      const errorMsg =
        (error instanceof HttpError ? error.response.data?.message : undefined) ||
        "Sign in failed. Please try again."
      throw new Error(errorMsg, { cause: error })
    } finally {
      loading.value = false
    }
  }

  /**
   * Logout user and clear all auth data
   */
  async function logout(): Promise<void> {
    try {
      await apiLogout()
    } catch {
      // Best-effort — always clear local state even if API call fails
    }

    // Clear local session state before attempting the tenant cache clear
    // below. If the dynamic import rejects (e.g. a chunk fetch failure after
    // a redeploy) or the store's own clear() throws, local teardown — and the
    // caller's post-logout navigation, since this function must not reject —
    // must still happen. Otherwise the user stays "logged in" client-side
    // against cookies the server just invalidated.
    clearUserData()
    user.value = null

    try {
      // Imported at call time, not at module scope: stores/tenant.ts imports the
      // router singleton and router/index.ts imports this store, so a static
      // import here would close a module cycle.
      const { useTenantStore } = await import("@/stores/tenant")
      useTenantStore().clear()
    } catch {
      // Best-effort — a stale tenant cache is a lesser problem than a client
      // that still thinks it is signed in.
    }

    message.success("Logged out successfully")
  }

  return {
    // State
    user,
    loading,
    // Getters
    isAuthenticated,
    currentUser,
    // Actions
    initAuth,
    signup,
    signin,
    logout,
  }
})

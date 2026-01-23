/**
 * Auth store - manages authentication state
 */

import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { message } from "ant-design-vue"
import { signup as apiSignup, signin as apiSignin } from "@/api/auth"
import { setTokens, setUserData, getUserData, getAccessToken, clearAuthData } from "@/utils/storage"

export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref(null)
  const loading = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!user.value && !!getAccessToken())
  const currentUser = computed(() => user.value)

  // Actions

  /**
   * Initialize auth state from localStorage
   * Called on app startup
   */
  function initAuth() {
    const storedUser = getUserData()
    const token = getAccessToken()
    if (storedUser && token) {
      user.value = storedUser
    }
  }

  /**
   * Register a new user
   * @param {string} username
   * @param {string} password
   */
  async function signup(username, password) {
    loading.value = true
    try {
      const response = await apiSignup(username, password)
      message.success("Account created successfully! Please sign in.")
      return response.data
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Signup failed. Please try again."
      throw new Error(errorMsg)
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign in user with credentials
   * @param {string} username
   * @param {string} password
   */
  async function signin(username, password) {
    loading.value = true
    try {
      const response = await apiSignin(username, password)
      const { id, username: name, access_token, refresh_token } = response.data.data

      // Store tokens
      setTokens(access_token, refresh_token)

      // Store user data
      const userData = { id, username: name }
      setUserData(userData)
      user.value = userData

      message.success("Signed in successfully!")
      return response.data
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Sign in failed. Please try again."
      throw new Error(errorMsg)
    } finally {
      loading.value = false
    }
  }

  /**
   * Logout user and clear all auth data
   */
  function logout() {
    clearAuthData()
    user.value = null
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

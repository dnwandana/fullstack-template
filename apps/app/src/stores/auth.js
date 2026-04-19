/**
 * Auth store - manages authentication state
 */

import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { message } from "ant-design-vue"
import {
  signup as apiSignup,
  signin as apiSignin,
  logout as apiLogout,
  getMe as apiGetMe,
} from "@/api/auth"
import { setUserData, getUserData, clearUserData } from "@/utils/storage"

export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref(null)
  const loading = ref(false)

  // Getters
  const isAuthenticated = computed(() => !!user.value)
  const currentUser = computed(() => user.value)

  // Actions

  /**
   * Initialize auth state from localStorage
   * Called on app startup
   */
  async function initAuth() {
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
   * @param {string} username
   * @param {string} password
   * @param {string} confirmation_password
   */
  async function signup(username, password, confirmation_password) {
    loading.value = true
    try {
      const response = await apiSignup(username, password, confirmation_password)
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
      const { id, username: name } = response.data.data

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
  async function logout() {
    try {
      await apiLogout()
    } catch {
      // Best-effort — always clear local state even if API call fails
    }
    clearUserData()
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

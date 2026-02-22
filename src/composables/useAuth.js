/**
 * Auth composable - form handling and validation for authentication
 */

import { ref, reactive } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "@/stores/auth"

export function useAuth() {
  const router = useRouter()
  const authStore = useAuthStore()

  // Form state
  const formState = reactive({
    username: "",
    password: "",
    confirmPassword: "",
  })

  // Error state
  const error = ref("")

  // Validation rules for Ant Design forms
  const usernameRules = [
    { required: true, message: "Please enter your username" },
    { min: 5, message: "Username must be at least 5 characters" },
  ]

  const passwordRules = [
    { required: true, message: "Please enter your password" },
    { min: 8, message: "Password must be at least 8 characters" },
  ]

  const confirmPasswordRules = [
    { required: true, message: "Please confirm your password" },
    {
      validator: async (_rule, value) => {
        if (value && value !== formState.password) {
          throw new Error("Passwords do not match")
        }
      },
    },
  ]

  /**
   * Handle sign in form submission
   */
  async function handleSignin() {
    error.value = ""
    try {
      await authStore.signin(formState.username, formState.password)
      router.push("/orgs")
    } catch (err) {
      error.value = err.message
    }
  }

  /**
   * Handle sign up form submission
   */
  async function handleSignup() {
    error.value = ""
    try {
      await authStore.signup(formState.username, formState.password)
      router.push("/login")
    } catch (err) {
      error.value = err.message
    }
  }

  /**
   * Handle logout
   */
  function handleLogout() {
    authStore.logout()
    router.push("/login")
  }

  /**
   * Reset form state
   */
  function resetForm() {
    formState.username = ""
    formState.password = ""
    formState.confirmPassword = ""
    error.value = ""
  }

  return {
    // State
    formState,
    error,
    loading: authStore.loading,
    isAuthenticated: authStore.isAuthenticated,
    currentUser: authStore.currentUser,
    // Validation rules
    usernameRules,
    passwordRules,
    confirmPasswordRules,
    // Actions
    handleSignin,
    handleSignup,
    handleLogout,
    resetForm,
  }
}

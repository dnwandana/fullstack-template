/**
 * Auth composable - form handling and validation for authentication
 */

import { ref, reactive } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useAuthStore } from "@/stores/auth"

/**
 * Resolve a post-authentication destination from an untrusted `?redirect=` value.
 *
 * `route.query.redirect` is attacker-controllable — a crafted link such as
 * /login?redirect=//evil.com would hand the user straight to another origin
 * immediately after they authenticate. Only same-origin relative paths are
 * honoured: a single leading slash, no protocol-relative `//` form, and no
 * backslash variant that browsers normalize into one. Anything else, including
 * an array (a repeated query key), falls back.
 *
 * @param {*} redirect - Raw `redirect` query value, of any shape
 * @param {string} fallback - Destination used when redirect is absent or unsafe
 * @returns {string} A safe path to navigate to
 */
function safeRedirect(redirect, fallback) {
  if (typeof redirect !== "string" || !redirect.startsWith("/")) {
    return fallback
  }
  if (redirect.startsWith("//") || redirect.startsWith("/\\")) {
    return fallback
  }
  return redirect
}

export function useAuth() {
  const router = useRouter()
  const route = useRoute()
  const authStore = useAuthStore()

  // Form state
  const formState = reactive({
    name: "",
    email: "",
    password: "",
    confirmation_password: "",
  })

  // Error state
  const error = ref("")

  // Validation rules for Ant Design forms
  const nameRules = [
    { required: true, whitespace: true, message: "Please enter your name" },
    { max: 100, message: "Name must be at most 100 characters" },
  ]

  const emailRules = [
    { required: true, message: "Please enter your email" },
    { type: "email", message: "Please enter a valid email address" },
    { max: 255, message: "Email must be at most 255 characters" },
  ]

  const passwordRules = [
    { required: true, message: "Please enter your password" },
    { min: 8, message: "Password must be at least 8 characters" },
  ]

  const confirmation_passwordRules = [
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
   * Honours a `?redirect=` query param so an invite link survives the detour
   * through the login page
   */
  async function handleSignin() {
    error.value = ""
    try {
      await authStore.signin(formState.email, formState.password)
      router.push(safeRedirect(route.query.redirect, "/orgs"))
    } catch (err) {
      error.value = err.message
    }
  }

  /**
   * Handle sign up form submission
   * Signup does not establish a session, so the user is sent on to /login —
   * carrying any `?redirect=` with them so the invitation stays redeemable
   */
  async function handleSignup() {
    error.value = ""
    try {
      await authStore.signup(
        formState.name,
        formState.email,
        formState.password,
        formState.confirmation_password,
      )
      const redirect = safeRedirect(route.query.redirect, "")
      router.push({ path: "/login", query: redirect ? { redirect } : {} })
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
    formState.name = ""
    formState.email = ""
    formState.password = ""
    formState.confirmation_password = ""
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
    nameRules,
    emailRules,
    passwordRules,
    confirmation_passwordRules,
    // Actions
    handleSignin,
    handleSignup,
    handleLogout,
    resetForm,
  }
}

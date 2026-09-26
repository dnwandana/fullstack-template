/**
 * Auth composable - form handling and validation for authentication
 */

import { computed, ref, reactive } from "vue"
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
 */
function safeRedirect(redirect: unknown, fallback: string): string {
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

  /**
   * Handle sign in form submission
   * Honours a `?redirect=` query param so an invite link survives the detour
   * through the login page
   */
  async function handleSignin(): Promise<void> {
    error.value = ""
    try {
      await authStore.signin(formState.email, formState.password)
      router.push(safeRedirect(route.query.redirect, "/orgs"))
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  /**
   * Handle sign up form submission
   * Signup does not establish a session, so the user is sent on to /login —
   * carrying any `?redirect=` with them so the invitation stays redeemable
   */
  async function handleSignup(): Promise<void> {
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
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  /**
   * Handle logout
   */
  function handleLogout(): void {
    authStore.logout()
    router.push("/login")
  }

  /**
   * Reset form state
   */
  function resetForm(): void {
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
    // Re-exposed as computed so the view sees live store state, read-only.
    // A bare `authStore.loading` reads through Pinia's ref unwrapping and is
    // captured once at setup, which left LoginView's spinner permanently off.
    loading: computed(() => authStore.loading),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    currentUser: computed(() => authStore.currentUser),
    // Actions
    handleSignin,
    handleSignup,
    handleLogout,
    resetForm,
  }
}

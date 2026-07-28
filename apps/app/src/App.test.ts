import { describe, it, expect } from "vitest"
import { mount, flushPromises } from "@vue/test-utils"
import { createPinia } from "pinia"
import { createRouter, createMemoryHistory, type Router } from "vue-router"
import App from "./App.vue"

// Unlike the component tests that mock vue-router wholesale, this suite drives
// the REAL router on purpose: the redirect-loop bug lives in the interaction
// with vue-router's initial-navigation lifecycle, which a mock hides entirely.
//
// vue-router's reactive route sits at START_LOCATION (path "/") until the first
// navigation resolves. That navigation is async because the app's beforeEach
// guard awaits initAuth()'s /auth/me call. If App.vue decides whether to show
// the org-scoped shell from route.path during that window, it mounts AppShell
// on EVERY cold load — including /login — whose onMounted data calls 401 while
// logged out and drive window.location.href = "/login" -> reload -> loop.

const routes = [
  {
    path: "/login",
    name: "Login",
    component: { template: "<div class='login-view' />" },
    meta: { requiresGuest: true },
  },
  {
    path: "/orgs",
    name: "OrgsList",
    component: { template: "<div class='orgs-view' />" },
    meta: { requiresAuth: true },
  },
  { path: "/", redirect: "/orgs" },
  { path: "/:pathMatch(.*)*", redirect: "/orgs" },
]

function mountApp(router: Router) {
  return mount(App, {
    global: {
      plugins: [createPinia(), router],
      // Stub the shell so we only assert on the mount decision, not its subtree
      // (which would pull in the tenant store + http).
      stubs: { AppShell: { name: "AppShell", template: "<div class='app-shell-stub' />" } },
    },
  })
}

describe("App chrome gating", () => {
  it("does not mount the org-scoped shell while the first navigation to /login is still resolving", async () => {
    // Hold the guard open to freeze the START_LOCATION window — exactly what
    // initAuth's awaited /auth/me does in production.
    let release: (() => void) | undefined
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach(async () => {
      await new Promise<void>((resolve) => (release = resolve))
    })
    router.push("/login") // async; parks on the held guard, route stays at "/"

    const wrapper = mountApp(router)
    await flushPromises() // navigation is still held; route has not advanced

    expect(wrapper.findComponent({ name: "AppShell" }).exists()).toBe(false)

    release?.()
  })

  it("mounts the shell once the router resolves to an app route", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push("/orgs")
    await router.isReady()

    const wrapper = mountApp(router)
    await flushPromises()

    expect(wrapper.findComponent({ name: "AppShell" }).exists()).toBe(true)
  })

  it("stays chromeless once the router resolves to /login", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push("/login")
    await router.isReady()

    const wrapper = mountApp(router)
    await flushPromises()

    expect(wrapper.findComponent({ name: "AppShell" }).exists()).toBe(false)
    expect(wrapper.find(".login-view").exists()).toBe(true)
  })
})

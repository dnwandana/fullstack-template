import { describe, it, expect, beforeEach, vi } from "vitest"
import { mount } from "@vue/test-utils"
import { createPinia, setActivePinia } from "pinia"

// vi.mock factories are hoisted above regular top-level statements (and this
// file's own local imports get converted to awaited dynamic imports that run
// ahead of any plain `const`), so a plain `const route = ref(...)` here would
// still be in its TDZ when the mock factory runs. vi.hoisted is *also*
// hoisted, and awaiting it lets the ref exist before anything else in the
// file executes.
const { route } = await vi.hoisted(async () => {
  const { ref } = await import("vue")
  return { route: ref({ params: {}, name: "OrgsList" }) }
})
vi.mock("vue-router", () => ({
  useRoute: () => route.value,
  RouterLink: { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" },
}))
vi.mock("@/router", () => ({ default: { currentRoute: route } }))

import AppBreadcrumb from "./AppBreadcrumb.vue"
import { useOrgsStore } from "@/stores/orgs"
import { useProjectsStore } from "@/stores/projects"

function mountAt(name, params) {
  setActivePinia(createPinia())
  route.value = { name, params }
  useOrgsStore().orgs = [{ id: "o1", name: "Acme" }]
  useProjectsStore().projects = [{ id: "p1", name: "Website" }]
  return mount(AppBreadcrumb)
}

const labels = (wrapper) => wrapper.vm.crumbs.map((c) => c.label)

describe("AppBreadcrumb", () => {
  beforeEach(() => setActivePinia(createPinia()))

  it("renders nothing on the orgs list", () => {
    const wrapper = mountAt("OrgsList", {})
    expect(wrapper.vm.crumbs).toEqual([])
    expect(wrapper.find(".app-breadcrumb").exists()).toBe(false)
  })

  it("shows just the org on the projects list", () => {
    expect(labels(mountAt("ProjectsList", { orgId: "o1" }))).toEqual(["Acme"])
  })

  it("appends a page crumb on an org sub-page", () => {
    expect(labels(mountAt("OrgMembers", { orgId: "o1" }))).toEqual(["Acme", "Members"])
  })

  it("shows org and project on the todo list without repeating the page", () => {
    expect(labels(mountAt("TodosList", { orgId: "o1", projectId: "p1" }))).toEqual([
      "Acme",
      "Website",
    ])
  })

  it("shows all three on a project sub-page", () => {
    expect(labels(mountAt("ProjectSettings", { orgId: "o1", projectId: "p1" }))).toEqual([
      "Acme",
      "Website",
      "Settings",
    ])
  })

  it("falls back to the id when the org has not been fetched yet", () => {
    setActivePinia(createPinia())
    route.value = { name: "ProjectsList", params: { orgId: "o9" } }
    expect(labels(mount(AppBreadcrumb))).toEqual(["o9"])
  })

  it("never links the last crumb", () => {
    const wrapper = mountAt("ProjectSettings", { orgId: "o1", projectId: "p1" })
    expect(wrapper.vm.crumbs.at(-1).to).toBeNull()
  })
})

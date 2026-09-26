import { describe, it, expect } from "vitest"
import { mount, type VueWrapper } from "@vue/test-utils"
import type { AuditLog, PaginationMeta, Wire } from "@fullstack/contracts"
import { makeAuditLog, makePaginationMeta } from "@/test/fixtures"
import AuditLogTable from "../AuditLogTable.vue"

/** Finds a pager button by its page number. Throws when the button is missing. */
function pageButton(wrapper: VueWrapper, page: number) {
  const found = wrapper.findAll("button").find((b) => b.text() === String(page))
  if (!found) throw new Error(`Missing page ${page} button`)
  return found
}

describe("AuditLogTable", () => {
  function mountTable(logs: Wire<AuditLog>[] = [makeAuditLog()], pagination?: PaginationMeta) {
    return mount(AuditLogTable, {
      props: {
        logs,
        loading: false,
        pagination: pagination ?? makePaginationMeta({ total_items: logs.length }),
        projectNames: { "proj-1": "Apollo" },
      },
    })
  }

  it("renders actor, action label, and entity", () => {
    const wrapper = mountTable()
    expect(wrapper.text()).toContain("Ada Lovelace")
    expect(wrapper.text()).toContain("Created todo")
    expect(wrapper.text()).toContain("Write the spec")
  })

  it("falls back to the raw action string for unknown actions", () => {
    const wrapper = mountTable([makeAuditLog({ action: "widget.frobbed" })])
    expect(wrapper.text()).toContain("widget.frobbed")
  })

  it("shows the project name from the lookup", () => {
    const wrapper = mountTable([makeAuditLog({ project_id: "proj-1" })])
    expect(wrapper.text()).toContain("Apollo")
  })

  it("shows a dash when the log has no project", () => {
    const wrapper = mountTable([makeAuditLog({ project_id: null })])
    expect(wrapper.text()).toContain("—")
  })

  it("renders one line per changed field when a row is expanded", async () => {
    const wrapper = mountTable([
      makeAuditLog({
        changes: {
          title: { from: "Old", to: "New" },
          is_completed: { from: false, to: true },
        },
      }),
    ])
    await wrapper.find('button[aria-label="Show changes"]').trigger("click")
    const lines = wrapper.findAll(".change-line")
    expect(lines).toHaveLength(2)
    expect(wrapper.text()).toContain("title")
    expect(wrapper.text()).toContain("Old")
    expect(wrapper.text()).toContain("New")
  })

  it("hides the expand control for rows without changes", () => {
    const wrapper = mountTable([makeAuditLog({ changes: null })])
    expect(wrapper.find('button[aria-label="Show changes"]').exists()).toBe(false)
  })

  it("emits page-change when the user clicks a pager item", async () => {
    const wrapper = mountTable(
      [makeAuditLog()],
      makePaginationMeta({
        total_items: 25,
        total_pages: 3,
        has_next_page: true,
        next_page: 2,
      }),
    )
    await pageButton(wrapper, 2).trigger("click")
    expect(wrapper.emitted("page-change")).toEqual([[2]])
  })

  it("never emits page-change for the current page", async () => {
    const wrapper = mountTable(
      [makeAuditLog()],
      makePaginationMeta({
        current_page: 2,
        total_items: 25,
        total_pages: 3,
        has_next_page: true,
        has_previous_page: true,
        next_page: 3,
        previous_page: 1,
      }),
    )
    await pageButton(wrapper, 2).trigger("click")
    expect(wrapper.emitted("page-change")).toBeUndefined()
  })
})

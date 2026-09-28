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

  it("sets the column widths and keeps every cell on one line", () => {
    const wrapper = mountTable()
    const widths = wrapper.findAll("th").map((th) => th.classes().find((c) => c.startsWith("w-")))
    expect(widths).toEqual([
      "w-[44px]",
      "w-[180px]",
      "w-[170px]",
      "w-[190px]",
      undefined,
      "w-[170px]",
    ])
    for (const td of wrapper.findAll("tbody td")) {
      expect(td.classes().some((c) => c === "whitespace-nowrap" || c === "truncate")).toBe(true)
    }
  })

  it("shows the date and time in muted tabular text", () => {
    const when = mountTable().findAll("tbody td")[1]
    expect(when?.text()).toBe("Jan 1, 2026, 00:00")
    expect(when?.classes()).toEqual(
      expect.arrayContaining(["text-muted-foreground", "tabular-nums"]),
    )
  })

  it("shows a 22 px avatar before the actor name in weight 500", () => {
    const actor = mountTable().findAll("tbody td")[2]
    const avatar = actor?.find('[data-slot="user-avatar"]')
    expect(avatar?.text()).toBe("A")
    expect(avatar?.classes()).toContain("size-[22px]")
    expect(actor?.find('[data-slot="actor-name"]').classes()).toContain("font-medium")
  })

  it("renders Sent invitation as a secondary badge", () => {
    const wrapper = mountTable([makeAuditLog({ action: "invitation.created" })])
    const badge = wrapper.find('[data-slot="badge"]')
    expect(badge.text()).toBe("Sent invitation")
    expect(badge.classes()).toContain("bg-secondary")
  })

  it("mutes the dash of an entry without a project", () => {
    const cells = mountTable([makeAuditLog({ project_id: null })]).findAll("tbody td")
    expect(cells[5]?.classes()).toContain("text-muted-foreground")
  })

  it("shows 5 skeleton rows of 6 cells on the first load", () => {
    const wrapper = mount(AuditLogTable, {
      props: { logs: [], loading: true, pagination: makePaginationMeta(), projectNames: {} },
    })
    expect(wrapper.findAll('[data-slot="skeleton-row"]')).toHaveLength(5)
    expect(wrapper.find('[data-slot="skeleton-row"]').findAll("td")).toHaveLength(6)
  })

  it("swaps the chevron, tints both rows and mutes the field name when a row expands", async () => {
    const wrapper = mountTable([makeAuditLog({ changes: { title: { from: "Old", to: "New" } } })])
    expect(wrapper.find("svg.lucide-chevron-right").exists()).toBe(true)
    await wrapper.find('button[aria-label="Show changes"]').trigger("click")
    expect(wrapper.find("svg.lucide-chevron-down").exists()).toBe(true)
    expect(wrapper.find("svg.lucide-chevron-right").exists()).toBe(false)
    const rows = wrapper.findAll("tbody tr")
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.classes()).toContain("bg-muted/60")
    const line = wrapper.find(".change-line")
    expect(line.text().replace(/\s+/g, " ")).toBe('title: "Old" → "New"')
    expect(line.findAll("span.text-muted-foreground").map((s) => s.text())).toEqual(["title:", "→"])
  })

  it("removes the tint when the row collapses", async () => {
    const wrapper = mountTable([makeAuditLog({ changes: { title: { from: "Old", to: "New" } } })])
    const button = wrapper.find('button[aria-label="Show changes"]')
    await button.trigger("click")
    await button.trigger("click")
    const rows = wrapper.findAll("tbody tr")
    expect(rows).toHaveLength(1)
    expect(rows[0]?.classes()).not.toContain("bg-muted/60")
  })
})

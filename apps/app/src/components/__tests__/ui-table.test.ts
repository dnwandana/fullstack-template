import { mount } from "@vue/test-utils"
import { h } from "vue"
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function mountTable() {
  return mount(Table, {
    slots: {
      default: () => [
        h(TableHeader, () => h(TableRow, () => h(TableHead, () => "Name"))),
        h(TableBody, () => [
          h(TableRow, () => h(TableCell, () => "Ada")),
          h(TableEmpty, { colspan: 1 }, () => "No members"),
        ]),
      ],
    },
  })
}

describe("Table density", () => {
  it("frames the table in a rounded card that scrolls sideways", () => {
    const classes = mountTable().find('[data-slot="table-container"]').classes()
    expect(classes).toEqual(
      expect.arrayContaining(["overflow-x-auto", "rounded-lg", "border", "bg-card"]),
    )
  })

  it("renders a 40 px muted header that does not wrap", () => {
    const classes = mountTable().find("th").classes()
    expect(classes).toEqual(
      expect.arrayContaining([
        "h-10",
        "bg-muted",
        "text-[13px]",
        "font-medium",
        "whitespace-nowrap",
      ]),
    )
  })

  it("pads each cell 10 px by 12 px", () => {
    const classes = mountTable().find("td").classes()
    expect(classes).toEqual(expect.arrayContaining(["px-3", "py-2.5"]))
    expect(classes).not.toContain("p-4")
  })

  it("renders the empty row with muted text", () => {
    const empty = mountTable().findAll("td").at(1)
    expect(empty?.text()).toBe("No members")
    expect(empty?.classes()).toContain("text-muted-foreground")
  })
})

import { mount } from "@vue/test-utils"
import { h } from "vue"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

afterEach(() => {
  document.body.innerHTML = ""
})

function mountDialog(): void {
  mount(Dialog, {
    props: { open: true },
    attachTo: document.body,
    slots: {
      default: () =>
        h(DialogContent, { "aria-describedby": undefined }, () => [
          h(DialogHeader, () => h(DialogTitle, () => "Create Todo")),
          h(DialogFooter, () => "buttons"),
        ]),
    },
  })
}

function mountAlert(): void {
  mount(AlertDialog, {
    props: { open: true },
    attachTo: document.body,
    slots: {
      default: () =>
        h(AlertDialogContent, () => [
          h(AlertDialogHeader, () => h(AlertDialogTitle, () => "Delete?")),
          h(AlertDialogFooter, () => "buttons"),
        ]),
    },
  })
}

function classesOf(selector: string): string {
  return document.body.querySelector(selector)?.className ?? ""
}

describe("Dialog", () => {
  it("uses the overlay token", async () => {
    mountDialog()
    await new Promise((r) => setTimeout(r))
    expect(document.body.querySelector(".bg-overlay")).not.toBeNull()
    expect(document.body.querySelector(".bg-black\\/80")).toBeNull()
  })

  it("caps the width and the height", async () => {
    mountDialog()
    await new Promise((r) => setTimeout(r))
    const content = classesOf('[role="dialog"]')
    expect(content).toContain("w-[min(512px,calc(100%-32px))]")
    expect(content).toContain("max-h-[calc(100vh-32px)]")
    expect(content).toContain("overflow-auto")
  })

  it("keeps the header left-aligned and the footer in one row", async () => {
    mountDialog()
    await new Promise((r) => setTimeout(r))
    expect(classesOf('[data-slot="dialog-header"]')).toContain("text-left")
    expect(classesOf('[data-slot="dialog-footer"]')).toContain("flex-row")
    expect(classesOf('[data-slot="dialog-footer"]')).not.toContain("flex-col-reverse")
  })
})

describe("AlertDialog", () => {
  it("is 440 px wide with a 16 px title", async () => {
    mountAlert()
    await new Promise((r) => setTimeout(r))
    expect(classesOf('[role="alertdialog"]')).toContain("w-[min(440px,calc(100%-32px))]")
    expect(classesOf('[data-slot="alert-dialog-title"]')).toContain("text-base")
  })
})

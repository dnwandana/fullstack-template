import { toast } from "vue-sonner"

/**
 * Copies an invitation link and shows one toast. Resolves false when the copy fails.
 * `navigator.clipboard` is undefined outside a secure context, for example on a plain-HTTP LAN
 * address. The property access then throws inside the `try`.
 */
export async function copyInviteLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Invitation link copied to clipboard")
    return true
  } catch {
    toast.error("Copy failed. Select the link and copy it by hand.")
    return false
  }
}

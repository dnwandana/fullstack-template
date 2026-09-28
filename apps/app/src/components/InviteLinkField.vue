<script setup lang="ts">
/** Shows an invitation link once, read-only, with a copy button. The API never returns it again. */
import { Copy } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { copyInviteLink } from "@/utils/clipboard"

const props = defineProps<{ url: string }>()

// A copy by hand is the fallback when the clipboard fails, so focus selects the whole link.
function selectAll(event: FocusEvent): void {
  if (event.target instanceof HTMLInputElement) event.target.select()
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Input
      :model-value="props.url"
      readonly
      aria-label="Invitation link"
      class="min-w-0 flex-1 font-mono text-[12px]"
      @focus="selectAll"
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Copy link"
      @click="copyInviteLink(props.url)"
    >
      <Copy />
    </Button>
  </div>
</template>

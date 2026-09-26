<script setup lang="ts">
/**
 * UserMenu — avatar dropdown with the signed-in user and a Logout action.
 *
 * Replaces AppLayout's loose user icon, name text and Logout button.
 */

import { computed } from "vue"
import { useRouter } from "vue-router"
import { LogOut } from "@lucide/vue"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/stores/auth"

const router = useRouter()
const authStore = useAuthStore()

const currentUser = computed(() => authStore.currentUser)

/** First letter of the display name, for the avatar. */
const initial = computed(() => currentUser.value?.name?.charAt(0)?.toUpperCase() ?? "")

/**
 * Sign out, then navigate.
 *
 * AWAIT is load-bearing: logout() clears the tenant permission caches, and
 * navigating first would race that clear. See 10b's task notes.
 */
async function handleLogout() {
  await authStore.logout()
  router.push({ name: "Login" })
}

defineExpose({ handleLogout })
</script>

<template>
  <DropdownMenu v-if="currentUser">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="user-menu gap-2 px-2">
        <Avatar class="size-7">
          <AvatarFallback class="text-xs">{{ initial }}</AvatarFallback>
        </Avatar>
        <span class="hidden max-w-[140px] truncate sm:inline">{{ currentUser.name }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel class="font-normal">
        <div class="flex flex-col gap-0.5">
          <span class="font-medium">{{ currentUser.name }}</span>
          <span class="font-mono text-xs text-muted-foreground">{{ currentUser.email }}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="handleLogout">
        <LogOut class="size-4" />
        Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

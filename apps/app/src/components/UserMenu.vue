<script setup lang="ts">
/**
 * UserMenu — avatar dropdown with the signed-in user and a Logout action.
 *
 * Replaces AppLayout's loose user icon, name text and Logout button.
 */

import { computed } from "vue"
import { useRouter } from "vue-router"
import { LogOut, Monitor, Moon, Sun } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/composables/useTheme"
import { useAuthStore } from "@/stores/auth"
import UserAvatar from "./UserAvatar.vue"

const router = useRouter()
const authStore = useAuthStore()

const { mode } = useTheme()

const currentUser = computed(() => authStore.currentUser)

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
      <Button
        variant="ghost"
        size="sm"
        class="user-menu gap-2 pr-2 pl-1 max-sm:rounded-full max-sm:px-0.5"
        :aria-label="`Account: ${currentUser.name}`"
      >
        <UserAvatar :name="currentUser.name" :size="28" />
        <span
          data-slot="user-trigger-name"
          class="hidden max-w-[140px] truncate font-medium sm:inline"
          >{{ currentUser.name }}</span
        >
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent data-slot="user-menu" align="end" class="w-[240px]">
      <DropdownMenuLabel class="grid gap-0.5 px-2 pt-1.5 pb-2 text-sm text-foreground">
        <span data-slot="user-name" class="truncate font-semibold">{{ currentUser.name }}</span>
        <span class="truncate font-mono text-xs font-normal text-muted-foreground">{{
          currentUser.email
        }}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger data-slot="theme-trigger">
          <Sun class="size-4 dark:hidden" />
          <Moon class="hidden size-4 dark:block" />
          Theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent class="w-40">
          <DropdownMenuRadioGroup v-model="mode">
            <DropdownMenuRadioItem value="auto">
              <Monitor class="size-4" />
              System
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light">
              <Sun class="size-4" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon class="size-4" />
              Dark
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="handleLogout">
        <LogOut />
        Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

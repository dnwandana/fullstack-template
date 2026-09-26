<script setup lang="ts">
/**
 * Public invitation landing page.
 *
 * Reached via the link in an invitation: /invite/:invitationId?token=<64hex>
 * Works logged out — the token alone gates the preview.
 *
 * States: loading → no-token | invalid | expired | handled | guest |
 *         wrong-account | ready
 */

import { ref, computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { CircleCheck, CircleX, Clock, Link2Off } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { InvitationPreview, Wire } from "@fullstack/contracts"
import { useAuthStore } from "@/stores/auth"
import { useInvitations } from "@/composables/useInvitations"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { previewInvitation, handleAccept } = useInvitations()

// The route is `/invite/:invitationId`, so the id is always present and every consumer wants a
// plain string — `String()` rather than `paramToString`, which exists for the params that may
// legitimately be absent.
const invitationId = String(route.params.invitationId)
// `route.query.token` stays raw so the `if (!token)` and `if (token)` checks below behave exactly
// as they do today — including for a repeated `?token=`, which arrives as an array and is truthy.
const token = route.query.token
const preview = ref<Wire<InvitationPreview> | null>(null)
const loaded = ref(false)
const accepting = ref(false)

/**
 * Derive which screen to render from the preview payload and session.
 * Ordered most-terminal first so an expired or already-handled invitation is
 * never presented as actionable.
 */
const state = computed(() => {
  if (!loaded.value) {
    return "loading"
  }
  // "No credential supplied" is not "credential rejected". Reached from the
  // in-app invitation list, which links here by ID because it never holds the
  // token — telling those users the invitation is invalid would be a lie.
  if (!token) {
    return "no-token"
  }
  if (!preview.value) {
    return "invalid"
  }
  if (preview.value.is_expired) {
    return "expired"
  }
  if (preview.value.status !== "pending") {
    return "handled"
  }
  if (!authStore.isAuthenticated) {
    return "guest"
  }
  if (authStore.currentUser?.email !== preview.value.invitee_email) {
    return "wrong-account"
  }
  return "ready"
})

/** Human-readable description of what the invitation grants access to */
const scopeLabel = computed(() =>
  preview.value?.project_name
    ? `${preview.value.project_name} (${preview.value.org_name})`
    : preview.value?.org_name,
)

// A link without ?token= carries no credential — skip the request and fall
// straight through to the invalid state.
onMounted(async () => {
  if (token) {
    preview.value = await previewInvitation(invitationId, String(token))
  }
  loaded.value = true
})

/**
 * Send a brand-new invitee to signup, preserving the invite link so they land
 * back here once they can authenticate
 */
function goToSignup(): void {
  router.push({
    path: "/signup",
    query: { redirect: route.fullPath, email: preview.value?.invitee_email },
  })
}

/**
 * Send an existing user to signin, preserving the invite link
 */
function goToLogin(): void {
  router.push({ path: "/login", query: { redirect: route.fullPath } })
}

/**
 * Redeem the invitation with the token from the link
 * Only navigates on success — the invitation can be revoked, expire, or be
 * accepted in another tab between the preview load and this click, and
 * redirecting anyway would imply a membership the user never got
 */
async function onAccept(): Promise<void> {
  accepting.value = true
  try {
    // TODO(ts-migration): a duplicated `?token=` used to POST `{ token: [...] }` and now POSTs the
    // comma-joined string. Both are rejected by AcceptInvitationDto, so no reachable flow changes.
    const result = await handleAccept(invitationId, String(token))
    if (result) {
      router.push("/orgs")
    }
  } finally {
    accepting.value = false
  }
}

/**
 * Sign out of the wrong account and return via signin
 */
async function switchAccount(): Promise<void> {
  await authStore.logout()
  goToLogin()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-muted p-4">
    <Card class="w-full max-w-[460px]">
      <CardContent class="pt-6">
        <div v-if="state === 'loading'" class="flex justify-center py-10">
          <Spinner class="size-6" />
        </div>

        <Empty v-else-if="state === 'no-token'">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Link2Off /></EmptyMedia>
            <EmptyTitle>Open this invitation from your email</EmptyTitle>
            <EmptyDescription>
              Invitation links carry a one-time code that isn't stored in your account, so this
              page can't open it on its own. Use the link you were sent, or ask whoever invited
              you to issue a new one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>

        <Empty v-else-if="state === 'invalid'">
          <EmptyHeader>
            <EmptyMedia variant="icon"><CircleX /></EmptyMedia>
            <EmptyTitle>This invitation is no longer valid</EmptyTitle>
            <EmptyDescription>
              The link may be incorrect, or the invitation was revoked.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>

        <Empty v-else-if="state === 'expired'">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Clock /></EmptyMedia>
            <EmptyTitle>This invitation has expired</EmptyTitle>
            <EmptyDescription>Ask whoever invited you to send a new one.</EmptyDescription>
          </EmptyHeader>
        </Empty>

        <Empty v-else-if="state === 'handled'">
          <EmptyHeader>
            <EmptyMedia variant="icon"><CircleCheck /></EmptyMedia>
            <EmptyTitle>This invitation was already {{ preview?.status }}</EmptyTitle>
          </EmptyHeader>
        </Empty>

        <div v-else class="space-y-6">
          <div class="space-y-1 text-center">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ preview?.inviter_name }} invited you to {{ scopeLabel }}
            </h1>
            <p class="text-sm text-muted-foreground">
              as <strong>{{ preview?.role_name }}</strong>
            </p>
            <p class="text-sm text-muted-foreground">{{ preview?.invitee_email }}</p>
          </div>

          <div v-if="state === 'guest'" class="flex flex-col gap-2">
            <Button v-if="preview?.requires_signup" @click="goToSignup">
              Create account &amp; join
            </Button>
            <Button v-else @click="goToLogin">Sign in &amp; join</Button>
            <Button v-if="preview?.requires_signup" variant="link" @click="goToLogin">
              I already have an account
            </Button>
          </div>

          <div v-else-if="state === 'wrong-account'" class="space-y-3 text-center">
            <p class="text-sm">
              You are signed in as {{ authStore.currentUser?.email }}, but this invitation is for
              {{ preview?.invitee_email }}.
            </p>
            <Button variant="outline" @click="switchAccount">Switch account</Button>
          </div>

          <Button v-else class="w-full" :disabled="accepting" @click="onAccept">
            <Spinner v-if="accepting" />
            Accept invitation
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

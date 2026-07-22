<script setup>
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
import { Card, Button, Result, Spin, Typography, Space } from "ant-design-vue"
import { useAuthStore } from "@/stores/auth"
import { useInvitations } from "@/composables/useInvitations"

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { previewInvitation, handleAccept } = useInvitations()

const invitationId = route.params.invitationId
const token = route.query.token
const preview = ref(null)
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
    preview.value = await previewInvitation(invitationId, token)
  }
  loaded.value = true
})

/**
 * Send a brand-new invitee to signup, preserving the invite link so they land
 * back here once they can authenticate
 * @returns {void}
 */
function goToSignup() {
  router.push({
    path: "/signup",
    query: { redirect: route.fullPath, email: preview.value.invitee_email },
  })
}

/**
 * Send an existing user to signin, preserving the invite link
 * @returns {void}
 */
function goToLogin() {
  router.push({ path: "/login", query: { redirect: route.fullPath } })
}

/**
 * Redeem the invitation with the token from the link
 * Only navigates on success — the invitation can be revoked, expire, or be
 * accepted in another tab between the preview load and this click, and
 * redirecting anyway would imply a membership the user never got
 * @returns {Promise<void>}
 */
async function onAccept() {
  accepting.value = true
  try {
    const result = await handleAccept(invitationId, token)
    if (result) {
      router.push("/orgs")
    }
  } finally {
    accepting.value = false
  }
}

/**
 * Sign out of the wrong account and return via signin
 * @returns {Promise<void>}
 */
async function switchAccount() {
  await authStore.logout()
  goToLogin()
}
</script>

<template>
  <div class="invite-container">
    <Card style="width: 460px">
      <Spin v-if="state === 'loading'" />

      <Result
        v-else-if="state === 'no-token'"
        status="info"
        title="Open this invitation from your email"
        sub-title="Invitation links carry a one-time code that isn't stored in your account, so
          this page can't open it on its own. Use the link you were sent, or ask whoever invited
          you to issue a new one."
      />

      <Result
        v-else-if="state === 'invalid'"
        status="error"
        title="This invitation is no longer valid"
        sub-title="The link may be incorrect, or the invitation was revoked."
      />

      <Result
        v-else-if="state === 'expired'"
        status="warning"
        title="This invitation has expired"
        sub-title="Ask whoever invited you to send a new one."
      />

      <Result
        v-else-if="state === 'handled'"
        status="info"
        :title="`This invitation was already ${preview.status}`"
      />

      <template v-else>
        <Typography.Title :level="4" style="text-align: center">
          {{ preview.inviter_name }} invited you to {{ scopeLabel }}
        </Typography.Title>
        <Typography.Paragraph style="text-align: center">
          as <strong>{{ preview.role_name }}</strong>
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style="text-align: center">
          {{ preview.invitee_email }}
        </Typography.Paragraph>

        <Space v-if="state === 'guest'" direction="vertical" style="width: 100%">
          <Button
            v-if="preview.requires_signup"
            type="primary"
            block
            size="large"
            @click="goToSignup"
          >
            Create account &amp; join
          </Button>
          <Button v-else type="primary" block size="large" @click="goToLogin">
            Sign in &amp; join
          </Button>
          <Button v-if="preview.requires_signup" block @click="goToLogin">
            I already have an account
          </Button>
        </Space>

        <Space v-else-if="state === 'wrong-account'" direction="vertical" style="width: 100%">
          <Typography.Text type="warning">
            You are signed in as {{ authStore.currentUser?.email }}, but this invitation is for
            {{ preview.invitee_email }}.
          </Typography.Text>
          <Button block @click="switchAccount">Switch account</Button>
        </Space>

        <Button v-else type="primary" block size="large" :loading="accepting" @click="onAccept">
          Accept invitation
        </Button>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.invite-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}
</style>

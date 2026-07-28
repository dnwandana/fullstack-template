<script setup lang="ts">
/**
 * MyInvitationsView — Displays the current user's received invitations in a table.
 *
 * Features:
 *   - Fetches the user's invitations on mount
 *   - Skeleton loading state while data is being fetched
 *   - Empty state when there are no invitations
 *   - Table with columns: Organization, Project, Status (color-coded Tag), Expires, Actions
 *   - Open-invitation and Decline actions for pending invitations
 *   - Popconfirm on Decline to prevent accidental rejection
 */

import { h, onMounted } from "vue"
import { useRouter } from "vue-router"
import { Table, Button, Tag, Typography, Space, Empty, Skeleton, Popconfirm } from "ant-design-vue"
import type { ColumnsType } from "ant-design-vue/es/table"
import type { MyInvitation, Wire } from "@fullstack/contracts"
import { useInvitations } from "@/composables/useInvitations"

const router = useRouter()
const { myInvitations, loading, fetchMyInvitations, handleDecline } = useInvitations()

/**
 * Navigate to the public invite landing page for an invitation.
 *
 * This list cannot accept directly: acceptance requires the raw token, which
 * only ever exists in the emailed link — hence "Open invitation" rather than
 * "Accept". Arriving there without a token renders the `no-token` state, which
 * explains that the link is the credential. It deliberately does NOT render
 * `invalid`: the invitation is fine, the browser just isn't carrying its code.
 *
 * Takes the id rather than the row: its only caller is the `#bodyCell` slot, whose `record` AntD
 * declares as `Record<string, any>` — a type that satisfies no named row shape. Reading `.id` off
 * it matches the sibling `handleDecline(record.id)` call and needs no cast.
 */
function goToInvite(invitationId: string): void {
  router.push({ name: "InviteAccept", params: { invitationId } })
}

/**
 * Map invitation status strings to Ant Design Tag color names.
 * Used in the Status column's customRender to visually differentiate states.
 * `status` is a plain string, not a union: the database column carries no constraint, so the
 * trailing "default" is a reachable branch rather than dead code.
 */
function getStatusColor(status: string): string {
  if (status === "pending") {
    return "blue"
  }
  if (status === "accepted") {
    return "green"
  }
  if (status === "declined") {
    return "red"
  }
  return "default"
}

/**
 * Format an ISO date string into a user-friendly locale representation.
 * The falsy guard stays even though `expires_at` is non-nullable — it also covers the empty
 * string, and dropping it would be a behaviour change.
 */
function formatDate(dateString: string): string {
  if (!dateString) {
    return "-"
  }
  return new Date(dateString).toLocaleString()
}

/** Table column definitions for the invitations table */
// TODO(ts-migration): org_name / project_name are available on the row and would read better here.
const columns: ColumnsType<Wire<MyInvitation>> = [
  {
    title: "Organization",
    dataIndex: "org_id",
    key: "org_id",
  },
  {
    title: "Project",
    dataIndex: "project_id",
    key: "project_id",
    /**
     * Render the project ID if present, otherwise show a dash
     * to indicate this is an org-level invitation.
     */
    customRender: ({ text }) => {
      if (text) {
        return text
      }
      return "-"
    },
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 120,
    /**
     * Render a color-coded Tag based on the invitation status.
     * Uses getStatusColor to map status to the appropriate Tag color.
     */
    customRender: ({ text }) => {
      return h(Tag, { color: getStatusColor(text) }, () => text)
    },
  },
  {
    title: "Expires",
    dataIndex: "expires_at",
    key: "expires_at",
    width: 200,
    customRender: ({ text }) => formatDate(text),
  },
  {
    title: "Actions",
    key: "actions",
    // Wider than the other action columns: "Open invitation" + "Decline" wrap at 200
    width: 240,
  },
]

// Fetch the current user's invitations on mount
onMounted(() => {
  fetchMyInvitations()
})
</script>

<template>
  <div class="my-invitations">
    <!-- Page title -->
    <Typography.Title :level="4" style="margin-bottom: 24px">My Invitations</Typography.Title>

    <!-- Loading skeleton shown while fetching and no invitations are cached yet -->
    <Skeleton v-if="loading && myInvitations.length === 0" active :paragraph="{ rows: 3 }" />

    <!-- Empty state when loading is complete but there are no invitations -->
    <Empty
      v-else-if="!loading && myInvitations.length === 0"
      description="No pending invitations"
    />

    <!-- Invitations table -->
    <Table
      v-else
      :columns="columns"
      :data-source="myInvitations"
      :row-key="(record) => record.id"
      :loading="loading"
      :pagination="false"
    >
      <!--
        Actions column: Open-invitation and Decline buttons are only shown for
        invitations with a "pending" status. Decline uses a Popconfirm
        to guard against accidental rejection.
      -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <Space v-if="record.status === 'pending'">
            <Button type="primary" size="small" @click="goToInvite(record.id)">
              Open invitation
            </Button>
            <Popconfirm
              title="Are you sure you want to decline this invitation?"
              ok-text="Yes"
              cancel-text="No"
              @confirm="handleDecline(record.id)"
            >
              <Button danger size="small">Decline</Button>
            </Popconfirm>
          </Space>
        </template>
      </template>
    </Table>
  </div>
</template>

<style scoped>
.my-invitations {
  width: 100%;
}
</style>

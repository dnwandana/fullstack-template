<script setup>
/**
 * MyInvitationsView — Displays the current user's received invitations in a table.
 *
 * Features:
 *   - Fetches the user's invitations on mount
 *   - Skeleton loading state while data is being fetched
 *   - Empty state when there are no invitations
 *   - Table with columns: Organization, Project, Status (color-coded Tag), Expires, Actions
 *   - Accept and Decline actions for pending invitations
 *   - Popconfirm on Decline to prevent accidental rejection
 */

import { h, onMounted } from "vue"
import { Table, Button, Tag, Typography, Space, Empty, Skeleton, Popconfirm } from "ant-design-vue"
import { useInvitations } from "@/composables/useInvitations"

const { myInvitations, loading, fetchMyInvitations, handleAccept, handleDecline } = useInvitations()

/**
 * Map invitation status strings to Ant Design Tag color names.
 * Used in the Status column's customRender to visually differentiate states.
 * @param {string} status - The invitation status (pending, accepted, declined)
 * @returns {string} Ant Design Tag color
 */
function getStatusColor(status) {
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
 * @param {string} dateString - ISO 8601 date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  if (!dateString) {
    return "-"
  }
  return new Date(dateString).toLocaleString()
}

/** Table column definitions for the invitations table */
const columns = [
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
    width: 200,
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
        Actions column: Accept and Decline buttons are only shown for
        invitations with a "pending" status. Decline uses a Popconfirm
        to guard against accidental rejection.
      -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <Space v-if="record.status === 'pending'">
            <Button type="primary" size="small" @click="handleAccept(record.id)"> Accept </Button>
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

<script setup>
/**
 * InvitationsTable — Displays a list of invitations in an Ant Design table.
 *
 * Features:
 *   - Color-coded status tags (pending, expired, accepted, declined)
 *   - Optional revoke button with confirmation (only for pending invitations)
 *   - Optional "New link" button that reissues the invitation (pending only)
 *
 * Props:
 *   - invitations: array of invitation objects
 *   - loading: table loading state
 *   - canRevoke: whether to show the revoke action
 *   - canResend: whether to show the reissue ("New link") action
 *
 * The actions column is rendered when either action is enabled.
 *
 * Emits:
 *   - revoke(invitationId) — when the user confirms revoking an invitation
 *   - resend(invitationId) — when the user asks for a fresh invitation link
 */

import { h, computed } from "vue"
import { Table, Tag, Button, Space, Popconfirm } from "ant-design-vue"

const props = defineProps({
  invitations: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  canRevoke: {
    type: Boolean,
    default: false,
  },
  canResend: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["revoke", "resend"])

/**
 * Display status for an invitation row.
 * `expired` is derived, not stored — nothing writes that status to the
 * database, so a stale row stays `pending` forever without this.
 * @param {Object} record - The invitation row
 * @returns {string} The status to show the user
 */
function displayStatus(record) {
  if (record.status === "pending" && new Date(record.expires_at) < new Date()) {
    return "expired"
  }
  return record.status
}

/**
 * Map a display status to an Ant Design Tag color.
 * There is deliberately no "revoked" branch — revoking hard-deletes the row,
 * so that status can never be observed.
 * @param {string} status - The display status
 * @returns {string} Ant Design tag color name
 */
function statusColor(status) {
  if (status === "accepted") return "green"
  if (status === "declined") return "red"
  if (status === "expired") return "default"
  return "blue"
}

/**
 * Handle invitation revocation after Popconfirm confirmation.
 * @param {string} invitationId - The invitation being revoked
 */
function handleRevoke(invitationId) {
  emit("revoke", invitationId)
}

/**
 * Handle a request for a fresh invitation link.
 * @param {string} invitationId - The invitation being reissued
 */
function handleResend(invitationId) {
  emit("resend", invitationId)
}

/**
 * Table column definitions.
 * The Actions column is conditionally included based on the canRevoke and
 * canResend props.
 */
const columns = computed(() => {
  const cols = [
    {
      title: "Invitee",
      key: "invitee",
      /**
       * Show the invitee email if available, otherwise fall back to the
       * invitee_id (UUID) for legacy rows without an email.
       */
      customRender: ({ record }) => {
        if (record.invitee_email) {
          return record.invitee_email
        }
        return record.invitee_id
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      // Render a color-coded tag based on the derived display status, so an
      // elapsed expiry reads as "expired" rather than "pending"
      customRender: ({ record }) => {
        const status = displayStatus(record)
        return h(Tag, { color: statusColor(status) }, () => status)
      },
    },
    {
      title: "Expires",
      dataIndex: "expires_at",
      key: "expires_at",
      // Format the ISO timestamp as a locale date string
      customRender: ({ text }) => {
        if (text) {
          return new Date(text).toLocaleDateString()
        }
        return "—"
      },
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      // Format the ISO timestamp as a locale date string
      customRender: ({ text }) => {
        if (text) {
          return new Date(text).toLocaleDateString()
        }
        return "—"
      },
    },
  ]

  // Only add the Actions column when the consumer enables at least one action
  if (props.canRevoke || props.canResend) {
    cols.push({
      title: "Actions",
      key: "actions",
      /**
       * Actions apply only to invitations that are still pending in the
       * database. Note this checks the stored status, not displayStatus —
       * an expired invitation is still stored as pending, and reissuing it
       * is exactly the recovery path for one, so its actions must stay live.
       * Accepted and declined invitations are terminal.
       */
      customRender: ({ record }) => {
        if (record.status !== "pending") {
          return null
        }
        const actions = []

        if (props.canResend) {
          actions.push(
            h(Button, { size: "small", onClick: () => handleResend(record.id) }, () => "New link"),
          )
        }

        if (props.canRevoke) {
          actions.push(
            h(
              Popconfirm,
              {
                title: "Are you sure you want to revoke this invitation?",
                okText: "Yes",
                cancelText: "No",
                onConfirm: () => handleRevoke(record.id),
              },
              () => h(Button, { danger: true, size: "small" }, () => "Revoke"),
            ),
          )
        }

        return h(Space, null, () => actions)
      },
    })
  }

  return cols
})
</script>

<template>
  <Table
    :columns="columns"
    :data-source="invitations"
    :loading="loading"
    :row-key="(record) => record.id"
    :pagination="false"
  />
</template>

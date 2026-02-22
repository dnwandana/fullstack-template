<script setup>
/**
 * OrgsListView — Displays the current user's organizations in a responsive card grid.
 *
 * Features:
 *   - Fetches all orgs on mount via the useOrgs composable
 *   - Skeleton loading state while data is being fetched
 *   - Empty state with a prompt to create the first organization
 *   - Card grid with responsive breakpoints (xs=24, sm=12, md=8, lg=6)
 *   - Each card shows the org name, description, and a "View Projects" link
 *   - OrgFormModal for creating new organizations
 */

import { onMounted } from "vue"
import { useRouter } from "vue-router"
import { Row, Col, Card, Button, Typography, Empty, Skeleton } from "ant-design-vue"
import { PlusOutlined } from "@ant-design/icons-vue"
import { useOrgs } from "@/composables/useOrgs"
import OrgFormModal from "@/components/OrgFormModal.vue"

const router = useRouter()

const {
  orgs,
  loading,
  isModalVisible,
  editingOrg,
  openCreateModal,
  closeModal,
  handleSubmit,
  fetchOrgs,
} = useOrgs()

/**
 * Navigate to the projects list for a given organization.
 * @param {string} orgId - Organization UUID to navigate to
 */
function viewProjects(orgId) {
  router.push(`/orgs/${orgId}`)
}

// Fetch all organizations when the component mounts
onMounted(() => {
  fetchOrgs()
})
</script>

<template>
  <div class="orgs-list">
    <!-- Header row with title and create button -->
    <div class="header">
      <Typography.Title :level="4" style="margin: 0">My Organizations</Typography.Title>

      <Button type="primary" @click="openCreateModal">
        <template #icon>
          <PlusOutlined />
        </template>
        Create Organization
      </Button>
    </div>

    <!-- Loading skeleton shown while fetching and no orgs are cached yet -->
    <Skeleton v-if="loading && orgs.length === 0" active :paragraph="{ rows: 3 }" />

    <!-- Empty state when loading is complete but there are no organizations -->
    <Empty v-else-if="!loading && orgs.length === 0" description="No organizations yet">
      <Button type="primary" @click="openCreateModal">Create your first organization</Button>
    </Empty>

    <!-- Responsive card grid showing all organizations -->
    <Row v-else :gutter="[16, 16]">
      <Col v-for="org in orgs" :key="org.id" :xs="24" :sm="12" :md="8" :lg="6">
        <Card class="org-card" :title="org.name" hoverable>
          <!-- Card body: description or fallback text -->
          <p v-if="org.description">{{ org.description }}</p>
          <p v-else class="no-description">No description</p>

          <!-- Card footer action -->
          <template #actions>
            <Button type="link" @click="viewProjects(org.id)">View Projects</Button>
          </template>
        </Card>
      </Col>
    </Row>

    <!-- Create / Edit organization modal -->
    <OrgFormModal
      :visible="isModalVisible"
      :org="editingOrg"
      :loading="loading"
      @submit="handleSubmit"
      @cancel="closeModal"
    />
  </div>
</template>

<style scoped>
.orgs-list {
  width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.org-card {
  height: 100%;
}

.no-description {
  color: rgba(0, 0, 0, 0.45);
  font-style: italic;
}
</style>

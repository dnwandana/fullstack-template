<script setup>
/**
 * OrgSwitcher — top-bar organization dropdown (artboard 05).
 *
 * Member counts and role tags are not in GET /api/orgs; they come from
 * GET /orgs/:orgId/members, one request per org. Those fire on FIRST OPEN, not
 * on mount, and the dropdown renders skeleton sub-lines while they land.
 */

import { ref, computed } from "vue"
import { useRouter } from "vue-router"
import { Dropdown, Menu, Avatar, Tag, Skeleton, Space } from "ant-design-vue"
import { DownOutlined } from "@ant-design/icons-vue"
import { useTenantStore } from "@/stores/tenant"
import { useOrgsStore } from "@/stores/orgs"

const router = useRouter()
const tenant = useTenantStore()
const orgsStore = useOrgsStore()

const open = ref(false)
const requested = ref(false)

const currentOrg = computed(() => tenant.currentOrg)
const orgs = computed(() => orgsStore.orgs)

/**
 * Cached metadata for one org, or null while the request is in flight.
 * @param {string} orgId
 * @returns {{memberCount:number, roleId:string|null, roleName:string|null}|null}
 */
function metaFor(orgId) {
  return tenant.orgMeta[orgId] ?? null
}

/**
 * Kick off metadata loading the first time the dropdown opens.
 * Deliberately not awaited — the menu must paint immediately.
 * @param {boolean} isOpen
 */
async function onOpenChange(isOpen) {
  open.value = isOpen
  if (isOpen && !requested.value) {
    requested.value = true
    await tenant.loadAllOrgMeta()
  }
}

/** @param {string} orgId */
function selectOrg(orgId) {
  open.value = false
  if (orgId !== tenant.currentOrgId) {
    router.push({ name: "ProjectsList", params: { orgId } })
  }
}

defineExpose({ metaFor, onOpenChange })
</script>

<template>
  <Dropdown v-if="currentOrg" :open="open" trigger="click" @open-change="onOpenChange">
    <button type="button" class="org-switcher ds-tenant">
      <Avatar size="small" shape="square">{{ currentOrg.name.charAt(0) }}</Avatar>
      <span class="org-switcher__name">{{ currentOrg.name }}</span>
      <DownOutlined />
    </button>

    <template #overlay>
      <Menu @click="({ key }) => selectOrg(key)">
        <Menu.Item v-for="org in orgs" :key="org.id">
          <div class="org-option">
            <span class="org-option__name">{{ org.name }}</span>

            <!-- Metadata arrives after the menu paints; hold the space. -->
            <Skeleton
              v-if="!metaFor(org.id)"
              active
              :title="false"
              :paragraph="{ rows: 1, width: 120 }"
            />
            <Space v-else size="small" class="ds-mono">
              <span>{{ metaFor(org.id).memberCount }} members</span>
              <Tag v-if="metaFor(org.id).roleName">{{ metaFor(org.id).roleName }}</Tag>
            </Space>
          </div>
        </Menu.Item>
      </Menu>
    </template>
  </Dropdown>
</template>

<style scoped>
/* .ds-tenant supplies the --teal-50 fill and --teal-300 border. Teal is also
   colorPrimary, so tenant chrome needs that extra tint to stay distinguishable
   from ordinary primary elements. */
.org-switcher {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  color: var(--text-primary);
}

.org-switcher__name {
  font-weight: 600;
}

.org-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
}
</style>

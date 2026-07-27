export type Permission = {
  id: string
  name: string
  resource: string
  action: string
  description: string | null
}

export type Role = {
  id: string
  org_id: string
  name: string
  description: string | null
  is_system: boolean
  created_at: Date
  updated_at: Date
  permissions: Permission[]
}

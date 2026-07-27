import type { PaginationMeta } from "./pagination"

export type Todo = {
  id: string
  project_id: string
  user_id: string
  title: string
  description: string | null
  is_completed: boolean
  created_at: Date
  updated_at: Date
}

export type TodoList = {
  data: Todo[]
  pagination: PaginationMeta
}

import type { User, Wire } from "@fullstack/contracts"

/**
 * User data storage utility
 * Handles localStorage operations for non-sensitive user data
 */

/** The auth payload as it arrives over the wire and is cached in localStorage. */
export type StoredUser = Wire<User>

const USER_DATA_KEY = "user_data"

// User data management
export function getUserData(): StoredUser | null {
  const data = localStorage.getItem(USER_DATA_KEY)
  return data ? JSON.parse(data) : null
}

export function setUserData(user: StoredUser): void {
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user))
}

export function clearUserData(): void {
  localStorage.removeItem(USER_DATA_KEY)
}

/**
 * User data storage utility
 * Handles localStorage operations for non-sensitive user data
 */

const USER_DATA_KEY = "user_data"

// User data management
export function getUserData() {
  const data = localStorage.getItem(USER_DATA_KEY)
  return data ? JSON.parse(data) : null
}

export function setUserData(user) {
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(user))
}

export function clearUserData() {
  localStorage.removeItem(USER_DATA_KEY)
}

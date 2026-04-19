const IS_PRODUCTION = process.env.NODE_ENV === "production"

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000

export function setAccessTokenCookie(res, token) {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/api",
    maxAge: ACCESS_TOKEN_MAX_AGE,
  })
}

export function setRefreshTokenCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  })
}

export function clearAuthCookies(res) {
  const opts = { maxAge: 0, httpOnly: true, secure: IS_PRODUCTION, sameSite: "strict" }
  res.cookie("access_token", "", { ...opts, path: "/api" })
  res.cookie("refresh_token", "", { ...opts, path: "/api/auth" })
}

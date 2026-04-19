import { Router } from "express"
import { requireAccessToken, requireRefreshToken } from "../middlewares/authorization.js"
import { authLimiter } from "../middlewares/rate-limit.js"
import * as authController from "../controllers/authentication.js"

const router = Router()

router.post("/signup", authLimiter, authController.signup)
router.post("/signin", authLimiter, authController.signin)
router.get("/me", authLimiter, requireAccessToken, authController.getMe)
router.post("/refresh", authLimiter, requireRefreshToken, authController.refreshAccessToken)
router.post("/logout", requireRefreshToken, authController.logout)

export default router

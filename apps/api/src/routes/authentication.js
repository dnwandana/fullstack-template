import { Router } from "express"
import { requireRefreshToken } from "../middlewares/authorization.js"
import { authLimiter } from "../middlewares/rate-limit.js"
import * as authController from "../controllers/authentication.js"

const router = Router()

router.post("/signup", authLimiter, authController.signup)
router.post("/signin", authLimiter, authController.signin)
router.post("/refresh", authLimiter, requireRefreshToken, authController.refreshAccessToken)

export default router

import { Router } from "express";
import {
  registerUser,
  loginUser,
  getProfile,
  checkUsernameAvailability
} from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/users/check-username", checkUsernameAvailability);
router.post("/users/register", registerUser);
router.post("/users/login", loginUser);
router.get("/users/me", requireAuth, getProfile);

export default router;


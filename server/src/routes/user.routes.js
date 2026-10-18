import { Router } from "express";
import {
  registerUser,
  loginUser,
  getProfile,
  checkUsernameAvailability
} from "../controllers/user.controller.js";

const router = Router();

router.get("/users/check-username", checkUsernameAvailability);
router.post("/users/register", registerUser);
router.post("/users/login", loginUser);
router.get("/users/me", getProfile);

export default router;


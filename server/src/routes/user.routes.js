import { Router } from "express";
import { registerUser, loginUser, getProfile } from "../controllers/user.controller.js";

const router = Router();

router.post("/users/register", registerUser);
router.post("/users/login", loginUser);
router.get("/users/me", getProfile);

export default router;


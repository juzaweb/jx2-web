import { Router } from "express";
import { getLeaderboard } from "../controllers/leaderboard.controller.js";

const router = Router();

router.get("/leaderboard", getLeaderboard);

export default router;

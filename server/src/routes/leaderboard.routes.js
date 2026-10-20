import { Router } from "express";
import { getLeaderboard, submitScore } from "../controllers/leaderboard.controller.js";
import { validateLeaderboardPayload } from "../middlewares/validate.js";

const router = Router();

router.get("/leaderboard", getLeaderboard);
router.post("/leaderboard/submit", validateLeaderboardPayload, submitScore);

export default router;

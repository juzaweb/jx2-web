import { Router } from "express";
import { importState } from "../controllers/state.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/state/import", requireAuth, importState);

export default router;

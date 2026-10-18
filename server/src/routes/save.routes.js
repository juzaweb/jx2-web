import { Router } from "express";
import { getSave, saveProgress, deleteSave } from "../controllers/save.controller.js";
import { validatePlayerId, validateSavePayload } from "../middlewares/validate.js";

const router = Router();

router.get("/save/:playerId", validatePlayerId, getSave);
router.post("/save/:playerId", validatePlayerId, validateSavePayload, saveProgress);
router.delete("/save/:playerId", validatePlayerId, deleteSave);

export default router;

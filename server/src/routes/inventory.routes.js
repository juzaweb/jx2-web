import { Router } from "express";
import { getInventory, updateInventory } from "../controllers/inventory.controller.js";
import { validatePlayerId, validateInventoryPayload } from "../middlewares/validate.js";

const router = Router();

router.get("/inventory/:playerId", validatePlayerId, getInventory);
router.put("/inventory/:playerId", validatePlayerId, validateInventoryPayload, updateInventory);

export default router;

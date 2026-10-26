import { Router } from "express";
import { getInventory } from "../controllers/inventory.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { validatePlayerId } from "../middlewares/validate.js";

const router = Router();

// Read-only debug surface. The bag itself is written exclusively over the
// WebSocket (`use_item` / `equip_item` / `unequip_slot` / `shop_buy`).
router.get("/inventory/:playerId", requireAuth, validatePlayerId, getInventory);

export default router;

import { Router } from "express";
import {
  listCharacters,
  createCharacter,
  deleteCharacter
} from "../controllers/character.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.get("/users/:userId/characters", requireAuth, listCharacters);
router.post("/users/:userId/characters", requireAuth, createCharacter);
router.delete("/users/:userId/characters/:characterId", requireAuth, deleteCharacter);

export default router;

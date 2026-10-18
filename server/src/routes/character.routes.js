import { Router } from "express";
import {
  listCharacters,
  createCharacter,
  deleteCharacter
} from "../controllers/character.controller.js";

const router = Router();

router.get("/users/:userId/characters", listCharacters);
router.post("/users/:userId/characters", createCharacter);
router.delete("/users/:userId/characters/:characterId", deleteCharacter);

export default router;

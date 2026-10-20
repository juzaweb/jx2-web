import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "jx2-backend",
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export default router;

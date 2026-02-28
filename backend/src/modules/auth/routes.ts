import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";

export const authRoutes = Router();

authRoutes.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user ?? null });
});


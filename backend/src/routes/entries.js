import { Router } from "express";

const router = Router();

router.all("/", (_req, res) => {
  res.status(501).json({ error: "Entry routes are not implemented yet." });
});

export default router;

import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

// Add your app routes here

export default router;

import express from "express";
import { refreshServiceEmbeddings } from "../controllers/embeddingController";
const router = express.Router();

router.post("/refresh-embedding", refreshServiceEmbeddings);

export default router;

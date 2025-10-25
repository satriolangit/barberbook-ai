import express from "express";
import { simulateChat } from "../controllers/chatController";
const router = express.Router();

router.post("/", simulateChat);

export default router;

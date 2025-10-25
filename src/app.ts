import express from "express";
import dotenv from "dotenv";
import chatRouter from "./routes/chat";
dotenv.config();

const app = express();
app.use(express.json());
app.use("/simulate", chatRouter); // single entry to simulate user messages

export default app;

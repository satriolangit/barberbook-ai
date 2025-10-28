import express from "express";
import dotenv from "dotenv";
import chatRouter from "./routes/chat";
import serviceRouter from "./routes/service";
dotenv.config();

const app = express();
app.use(express.json());
app.use("/simulate", chatRouter); // single entry to simulate user messages
app.use("/services", serviceRouter);

export default app;

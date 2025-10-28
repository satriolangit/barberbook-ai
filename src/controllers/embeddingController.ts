import { Request, Response } from "express";
import { refreshAllServiceEmbeddings } from "../services/embeddingService";

export const refreshServiceEmbeddings = async (req: Request, res: Response) => {
  try {
    await refreshAllServiceEmbeddings();
    res.status(200).json({ message: "Success refreshing services embeddings" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to refresh services embeddings" });
  }
};

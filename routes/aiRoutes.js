import express from "express";
import { generateArticle } from "../controllers/aiController.js";
import { auth } from "../middlewares/auth.js";
import { requireAuth } from "@clerk/express";   

const aiRouter = express.Router();

aiRouter.post("/generate-article", requireAuth(), auth, generateArticle);

export default aiRouter;
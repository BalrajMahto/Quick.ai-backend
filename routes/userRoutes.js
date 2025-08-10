import express from 'express';
import { getPublishedCreations, getUserCreations, toggleLikeCreations } from '../controllers/userController.js';
import { clerkMiddleware } from '@clerk/express';
import e from 'express';
import { auth } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.get('/get-user-creations', auth,getUserCreations);
userRouter.get('/get-published-creations',auth,getPublishedCreations);
userRouter.post('/toggle-like-creations',auth,toggleLikeCreations);

export default userRouter;

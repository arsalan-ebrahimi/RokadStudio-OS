import express from "express";
import { login, me } from "./authCn.js";
import { loginValidator } from "./authValidator.js";
import { isLogin } from "../../Middlewares/isLogin.js";
import { loginRateLimiter } from "../../Middlewares/rateLimit.js";

const authRouter = express.Router();

authRouter.post("/login", loginRateLimiter, loginValidator, login);
authRouter.get("/me", isLogin, me);

export default authRouter;

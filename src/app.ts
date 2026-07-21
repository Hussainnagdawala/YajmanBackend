import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger";
import { globalRateLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS_LIST,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(globalRateLimiter);

app.get("/health", (_req, res) => res.status(200).json({ success: true, message: "OK" }));

app.use(`/api/${env.API_VERSION}`, routes);

app.use(notFoundHandler);
app.use(errorHandler);

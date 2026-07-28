import path from "path";
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
app.use(cors()
  // cors({
  //   // origin: "*",
  //   // credentials: true,
  // })
);

// Local disk uploads (temporary stand-in for S3, see middleware/upload.ts).
// helmet() sets Cross-Origin-Resource-Policy: same-origin by default, which
// would silently block the website/app from loading these images at all if
// they're on a different origin/port — override it just for this static mount.
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res) => res.set("Cross-Origin-Resource-Policy", "cross-origin"),
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(globalRateLimiter);

app.get("/health", (_req, res) => res.status(200).json({ success: true, message: "OK" }));

app.use(`/api/${env.API_VERSION}`, routes);

app.use(notFoundHandler);
app.use(errorHandler);

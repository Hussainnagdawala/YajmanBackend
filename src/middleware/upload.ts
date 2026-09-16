import fs from "fs";
import path from "path";
import multer from "multer";
import { RequestHandler, Request, Response, NextFunction } from "express";
import multerS3 from "multer-s3";
import { s3Client } from "../config/s3";
import { env } from "../config/env";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// ── LOCAL DISK STORAGE (disabled) ────────────────────────────
/* const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = req.uploadFolder || "general";
    const dir = path.join(UPLOAD_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
}); */

// ── S3 STORAGE (active) ──────────────────────────────────────
const s3Storage = multerS3({
  s3: s3Client,
  bucket: env.DO_SPACES_BUCKET,
  acl: "public-read",
  key: (req, file, cb) => {
    const folder = req.uploadFolder || "general";
    const filename = [env.DO_PARENT_FOLDER, folder, `${Date.now()}-${file.originalname}`]
      .filter(Boolean)
      .join("/");
    cb(null, filename);
  },
});

const upload = multer({
  storage: s3Storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

// multer-s3 attaches `.location` (the public URL) to every uploaded file;
// diskStorage doesn't attach any URL at all, only `.path`/`.filename`. Every
// controller in this codebase reads `file.location`, so this attaches the
// same property pointing at the local static URL — no controller changes
// needed when swapping storage backends either direction.
const attachLocation = (req: Request): void => {
  const folder = req.uploadFolder || "general";
  const toLocation = (file: Express.Multer.File) => {
    (file as Express.Multer.File & { location?: string }).location =
      `http://localhost:${env.PORT}/uploads/${folder}/${file.filename}`;
  };

  if (req.file) toLocation(req.file);
  if (Array.isArray(req.files)) {
    req.files.forEach(toLocation);
  } else if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((files) => files.forEach(toLocation));
  }
};

// Cast: @types/multer nests its own @types/express which conflicts with the app's Express types.
const wrap = (mw: RequestHandler): RequestHandler =>
  ((req: Request, res: Response, next: NextFunction) => {
    mw(req, res, (err: unknown) => {
      if (err) return next(err);
      // attachLocation(req); // Removed for S3 since multer-s3 provides .location directly
      next();
    });
  }) as unknown as RequestHandler;

export const uploadSingle = (field: string) => wrap(upload.single(field) as unknown as RequestHandler);
export const uploadArray = (field: string, max: number) => wrap(upload.array(field, max) as unknown as RequestHandler);
export const uploadFields = (fields: multer.Field[]) => wrap(upload.fields(fields) as unknown as RequestHandler);

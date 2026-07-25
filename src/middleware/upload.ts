import multer from "multer";
import multerS3 from "multer-s3";
import { RequestHandler } from "express";
import { s3Client } from "../config/s3";
import { env } from "../config/env";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: env.S3_BUCKET,
    key: (req, file, cb) => {
      const folder = req.uploadFolder || "general";
      const filename = `${folder}/${Date.now()}-${file.originalname}`;
      cb(null, filename);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
  },
});

// Cast: @types/multer nests its own @types/express which conflicts with the app's Express types.
export const uploadSingle = (field: string) => upload.single(field) as unknown as RequestHandler;
export const uploadArray = (field: string, max: number) =>
  upload.array(field, max) as unknown as RequestHandler;
export const uploadFields = (fields: multer.Field[]) =>
  upload.fields(fields) as unknown as RequestHandler;

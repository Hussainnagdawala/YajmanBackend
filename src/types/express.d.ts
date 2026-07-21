import { AuthUser } from "./models";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      uploadFolder?: string;
    }
  }
}

export {};

import crypto from "crypto";
import bcrypt from "bcryptjs";

export const generateOtp = (length = 6): string => {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, "0");
};

export const hashValue = async (value: string): Promise<string> => bcrypt.hash(value, 10);

export const compareHash = async (value: string, hash: string): Promise<boolean> => bcrypt.compare(value, hash);

export const generateToken = (bytes = 32): string => crypto.randomBytes(bytes).toString("hex");

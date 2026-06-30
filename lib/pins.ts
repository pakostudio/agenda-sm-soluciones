import { createHash, randomBytes } from "crypto";

export const generatePin = () => String(Math.floor(100000 + Math.random() * 900000));

export const hashPin = (pin: string, salt = randomBytes(16).toString("hex")) => ({
  salt,
  hash: createHash("sha256").update(`${salt}:${pin}`).digest("hex")
});

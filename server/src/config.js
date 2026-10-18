import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || "0.0.0.0",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  env: process.env.NODE_ENV || "development",
  dataPath: process.env.DATA_PATH || path.resolve(__dirname, "../data/db.json"),
};

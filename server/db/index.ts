import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema";
import ws from "ws";

// Enable WebSocket for local development
if (process.env.NODE_ENV !== "production") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL!;

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

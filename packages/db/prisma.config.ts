import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrlFrom } from "./src/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: databaseUrlFrom(process.env) ?? "" },
});

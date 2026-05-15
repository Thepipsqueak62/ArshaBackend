// src/migrate.ts
import { getMigrations } from "better-auth/db/migration";
import {auth} from "./utils/betterAuthConfig.js";

async function migrate() {
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    console.log("✅ Migrations complete");
    process.exit(0);
}

migrate().catch((err) => {
    console.error(err);
    process.exit(1);
});
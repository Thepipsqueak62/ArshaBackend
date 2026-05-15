import Fastify from "fastify"
import cors from '@fastify/cors'
import {getMigrations} from "better-auth/db/migration";
import path from "path";
import fs from "fs";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import FastifyBetterAuth from "fastify-better-auth";
import rateLimit from "@fastify/rate-limit";
import profileRoutes from "./routes/dashboardRoutes/dashboard.js";
import runProfileMigration from "./db/migrations/runProfileMigration.js";
import {auth} from "./utils/betterAuthConfig.js";
import 'dotenv/config'
console.log("ENV CHECK:", !!process.env.DISCORD_WEBHOOK_URL); // add this temporarily

import notifyDiscord from "./utils/discordNotify.js";



const fastify = Fastify({ logger: true }); // ← moved to module scope

async function start() {
    try {
        const port = Number(process.env.PORT ?? 3001);
        const host = process.env.HOST ?? "0.0.0.0";

        const { runMigrations } = await getMigrations(auth.options);
        await runMigrations();
        runProfileMigration();


// Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
        fs.mkdirSync(uploadsDir, { recursive: true });

        await fastify.register(cors, {
            origin: process.env.NEXTJS_URL ?? "http://localhost:3000",
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        });
// File upload support
        await fastify.register(multipart, {
            limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
        });
// Serve uploaded avatars statically
// e.g. http://localhost:3001/uploads/avatars/xyz.jpg
        await fastify.register(staticFiles, {
            root: path.join(process.cwd(), "uploads"),
            prefix: "/uploads/",
        });
        await fastify.register(FastifyBetterAuth, { auth: auth as any });
        await fastify.register(rateLimit, {
            max: 20,
            timeWindow: "1 minute",
            keyGenerator: (req: any) => req.body?.email || req.ip,
        });


// Health check
        fastify.get('/health', async () => {
            return { status: 'OK', timestamp: new Date().toISOString() };
        });



        await fastify.register(profileRoutes);
        await fastify.listen({ port, host });
        console.log("Webhook URL:", process.env.DISCORD_WEBHOOK_URL); // debug


        await notifyDiscord(`✅ Auth server online on \`${host}:${port}\``);
    } catch (e) {
        fastify.log.error(e);
        await notifyDiscord(`🔴 Auth server failed to start: \`${e}\``);
        process.exit(1);
    }
}

start();

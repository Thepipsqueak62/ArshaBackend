/*
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import FastifyBetterAuth from "fastify-better-auth";
import Database from "better-sqlite3";
import { emailOTP } from "better-auth/plugins";
import rateLimit from "@fastify/rate-limit";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// ========================
// DATABASE
// ========================
const db = new Database("./dev.db");

// ========================
// AUTH CONFIG
// ========================
export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
    database: db,
    emailAndPassword: { enabled: true },
    trustedOrigins: [
        process.env.NEXTJS_URL ?? "http://localhost:3000",
    ],
    plugins: [
        emailOTP({
            otpLength: 6,
            expiresIn: 300,
            sendVerificationOnSignUp: true,
            async sendVerificationOTP({ email, otp, type }) {
                console.log(`[OTP] ${type} OTP for ${email}: ${otp}`);
            },
        }),
    ],
    advanced: {
        defaultCookieAttributes: {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
        },
    },
});

// ========================
// PROFILE TABLE MIGRATION
// ========================
function runProfileMigration() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS profile (
                                               userId          TEXT PRIMARY KEY,
                                               username        TEXT UNIQUE,
                                               bio             TEXT,
                                               location        TEXT,
                                               website         TEXT,
                                               twitterHandle   TEXT,
                                               twitchHandle    TEXT,
                                               discordHandle   TEXT,
                                               createdAt       TEXT DEFAULT (datetime('now')),
            updatedAt       TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
            );
    `);
    console.log("✅ Profile table ready");
}

// ========================
// SESSION HELPER
// ========================
async function requireSession(req: any, reply: any) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
        return reply.code(401).send({ message: "Unauthorized" });
    }
    req.user = session.user;
}

// ========================
// PROFILE ROUTES
// ========================
async function profileRoutes(app: FastifyInstance) {

    // GET /profile/me
    app.get("/profile/me", { preHandler: requireSession }, async (req: any, reply) => {
        const user = db
            .prepare("SELECT id, name, image, createdAt FROM user WHERE id = ?")
            .get(req.user.id) as any;

        const profile = db
            .prepare("SELECT * FROM profile WHERE userId = ?")
            .get(req.user.id) as any;

        return reply.send({
            displayName: user.name,
            email:       req.user.email,
            image:       user.image ?? null, // raw path e.g. /uploads/avatars/file.jpg
            joinedAt: user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : null,
            username:  profile?.username  ?? null,
            bio:       profile?.bio       ?? "",
            location:  profile?.location  ?? "",
            website:   profile?.website   ?? "",
            socials: {
                twitter: profile?.twitterHandle ?? "",
                twitch:  profile?.twitchHandle  ?? "",
                discord: profile?.discordHandle ?? "",
            },
        });
    });

    // GET /profile/:username — public
    app.get("/profile/:username", async (req: any, reply) => {
        const { username } = req.params;

        const profile = db
            .prepare("SELECT * FROM profile WHERE username = ?")
            .get(username) as any;

        if (!profile) return reply.code(404).send({ message: "Profile not found" });

        const user = db
            .prepare("SELECT id, name, image, createdAt FROM user WHERE id = ?")
            .get(profile.userId) as any;

        if (!user) return reply.code(404).send({ message: "User not found" });

        return reply.send({
            displayName: user.name,
            image: user.image ?? null, // raw path e.g. /uploads/avatars/file.jpg
            joinedAt: user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : null,
            username:  profile.username,
            bio:       profile.bio      ?? "",
            location:  profile.location ?? "",
            website:   profile.website  ?? "",
            socials: {
                twitter: profile.twitterHandle ?? "",
                twitch:  profile.twitchHandle  ?? "",
                discord: profile.discordHandle ?? "",
            },
        });
    });

    // PUT /profile
    app.put("/profile", { preHandler: requireSession }, async (req: any, reply) => {
        const { displayName, username, bio, location, website, socials } = req.body as any;

        if (username) {
            const existing = db
                .prepare("SELECT userId FROM profile WHERE username = ? AND userId != ?")
                .get(username, req.user.id);

            if (existing) {
                return reply.code(409).send({ message: "Username already taken" });
            }
        }

        db.prepare(`
            INSERT INTO profile (userId, username, bio, location, website, twitterHandle, twitchHandle, discordHandle, updatedAt)
            VALUES (@userId, @username, @bio, @location, @website, @twitterHandle, @twitchHandle, @discordHandle, @updatedAt)
                ON CONFLICT(userId) DO UPDATE SET
                username      = excluded.username,
                                           bio           = excluded.bio,
                                           location      = excluded.location,
                                           website       = excluded.website,
                                           twitterHandle = excluded.twitterHandle,
                                           twitchHandle  = excluded.twitchHandle,
                                           discordHandle = excluded.discordHandle,
                                           updatedAt     = excluded.updatedAt
        `).run({
            userId:        req.user.id,
            username:      username         ?? null,
            bio:           bio              ?? null,
            location:      location         ?? null,
            website:       website          ?? null,
            twitterHandle: socials?.twitter ?? null,
            twitchHandle:  socials?.twitch  ?? null,
            discordHandle: socials?.discord ?? null,
            updatedAt:     new Date().toISOString(),
        });

        if (displayName && displayName !== req.user.name) {
            db.prepare("UPDATE user SET name = ?, updatedAt = ? WHERE id = ?")
                .run(displayName, new Date().toISOString(), req.user.id);
        }

        return reply.send({ ok: true });
    });

    app.get("/test", async (req: any, reply) => {
        reply.send({
            message: "hello",
            message_id:"23"
        });
    })
    app.post("/testpost/", async (req: any, reply) => {
        const { message_id } = req.body as any;

        if (!message_id) {
            return reply.status(400).send({ error: "message_id is required" });
        }

        const get_message = db
            .prepare("SELECT * FROM message WHERE message_id = ?")
            .get(message_id) as any;

        if (!get_message) {
            return reply.status(404).send({ error: "Message not found" });
        }

        return reply.send({ return_message: get_message.return_message });
    });


    // POST /profile/avatar
    app.post("/profile/avatar", { preHandler: requireSession }, async (req: any, reply) => {
        const data = await req.file();

        if (!data) {
            return reply.code(400).send({ message: "No file provided" });
        }

        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(data.mimetype)) {
            return reply.code(400).send({ message: "Only JPG, PNG, and WebP are allowed" });
        }

        // Delete old avatar file if stored locally
        const existing = db
            .prepare("SELECT image FROM user WHERE id = ?")
            .get(req.user.id) as any;

        if (existing?.image?.startsWith("/uploads/")) {
            const oldPath = path.join(process.cwd(), existing.image.slice(1));
            fs.unlink(oldPath, () => {});
        }

        // Save new file to disk
        const ext = data.mimetype.split("/")[1].replace("jpeg", "jpg");
        const filename = `${req.user.id}-${crypto.randomUUID()}.${ext}`;
        const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
        const filepath = path.join(uploadsDir, filename);
        const buffer = await data.toBuffer();
        fs.writeFileSync(filepath, buffer);

        const avatarUrl = `/uploads/avatars/${filename}`;

        db.prepare("UPDATE user SET image = ?, updatedAt = ? WHERE id = ?")
            .run(avatarUrl, new Date().toISOString(), req.user.id);

        return reply.send({
            ok: true,
            url: avatarUrl, // raw path — frontend proxies via Next.js rewrites
        });
    });
}

// ========================
// SERVER BOOTSTRAP
// ========================
async function bootstrap() {
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    runProfileMigration();

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const app = Fastify({ logger: true });

    await app.register(cors, {
        origin: process.env.NEXTJS_URL ?? "http://localhost:3000",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    });

    // File upload support
    await app.register(multipart, {
        limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    });

    // Serve uploaded avatars statically
    // e.g. http://localhost:3001/uploads/avatars/xyz.jpg
    await app.register(staticFiles, {
        root: path.join(process.cwd(), "uploads"),
        prefix: "/uploads/",
    });

    await app.register(FastifyBetterAuth, { auth: auth as any });

    await app.register(rateLimit, {
        max: 20,
        timeWindow: "1 minute",
        keyGenerator: (req: any) => req.body?.email || req.ip,
    });

    await app.register(profileRoutes);

    app.get("/", async () => ({ ok: true }));

    await app.listen({
        port: Number(process.env.PORT ?? 3001),
        host: "0.0.0.0",
    });

    console.log("🚀 Auth server running on http://localhost:3001");
}

bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});*/

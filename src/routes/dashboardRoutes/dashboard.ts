import {FastifyInstance} from "fastify";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {db} from "../../db/createdb.js";
import requireSession from "../../utils/sessionHelper.js";

export default async function profileRoutes(app: FastifyInstance) {

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
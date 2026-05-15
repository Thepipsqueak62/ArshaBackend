import {db} from "../createdb.js";

export default function runProfileMigration() {
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
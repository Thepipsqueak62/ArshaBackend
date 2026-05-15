
export default async function notifyDiscord(message: string) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return; // silently skip in dev

    await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: message,
            // or use an embed for something cleaner:
            // embeds: [{ title: "Server Online", description: message, color: 0x00ff00 }]
        }),
    }).catch(() => {}); // never let a notification crash your server
}
import {auth} from "./betterAuthConfig.js";


export default async function requireSession(req: any, reply: any) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
        return reply.code(401).send({ message: "Unauthorized" });
    }
    req.user = session.user;
}
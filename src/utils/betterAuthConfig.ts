import {betterAuth} from "better-auth";
import {emailOTP} from "better-auth/plugins";
import {db} from "../db/createdb.js";

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
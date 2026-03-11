const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { beforeUserCreated, HttpsError } = require("firebase-functions/v2/identity");
const { onCall } = require("firebase-functions/v2/https");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { CloudBillingClient } = require("@google-cloud/billing");
const { Resend } = require("resend");

initializeApp();
const db = getFirestore();

const MAX_SIGNUPS_PER_IP_PER_DAY = 3;

/**
 * Blocking function that runs before every new account is created.
 * Rejects the request if the originating IP has already created
 * MAX_SIGNUPS_PER_IP_PER_DAY accounts today.
 */
exports.limitSignups = beforeUserCreated(
    {
        // Cap scaling to prevent runaway billing under abuse.
        maxInstances: 10,
        memory: "256MiB",
        timeoutSeconds: 10,
        region: "us-central1",
    },
    async (event) => {
        const ip = event.ipAddress;
        if (!ip) return;               // No IP available — allow (shouldn't happen in practice).

        const today = new Date().toISOString().slice(0, 10);   // "YYYY-MM-DD"
        const docRef = db.collection("signupLimits").doc(`${ip}_${today}`);

        const doc = await docRef.get();
        const count = doc.exists ? doc.data().count : 0;

        if (count >= MAX_SIGNUPS_PER_IP_PER_DAY) {
            throw new HttpsError(
                "resource-exhausted",
                "Too many accounts created from this network today. Please try again tomorrow."
            );
        }

        // Increment the counter (create if it doesn't exist).
        // `expireAt` enables Firestore TTL to auto-delete docs after 48 h.
        const expireAt = Timestamp.fromDate(
            new Date(Date.now() + 48 * 60 * 60 * 1000)
        );
        await docRef.set(
            { count: FieldValue.increment(1), ip, date: today, expireAt },
            { merge: true }
        );
    }
);

const PROJECT_ID = "daggerquest-backend";
const PROJECT_NAME = `projects/${PROJECT_ID}`;
const billing = new CloudBillingClient();

// ── Custom Email Sending ──────────────────────────────────────────────────

const ACTION_URL = "https://daggerquest.com/auth/action";

function getResend() {
    return new Resend(process.env.RESEND_API_KEY);
}

function emailTemplate(title, bodyContent) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Grenze:wght@600&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Grenze',Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#1a1209,#0f0d06);border:1px solid #3a3020;border-radius:8px;padding:40px;">
<tr><td align="center" style="padding-bottom:24px;">
  <img src="https://daggerquest.com/images/logo.webp" alt="DaggerQuest" width="220" style="display:block;" />
</td></tr>
<tr><td align="center" style="font-family:'Cinzel',Georgia,serif;color:#e2c97e;font-size:22px;padding-bottom:16px;letter-spacing:2px;">
  ${title}
</td></tr>
<tr><td style="font-family:'Grenze',Georgia,serif;color:#b8a66a;font-size:16px;line-height:1.6;padding:0 10px;">
  ${bodyContent}
</td></tr>
</table>
<table width="480" cellpadding="0" cellspacing="0" style="padding-top:20px;">
<tr><td align="center" style="font-family:'Grenze',Georgia,serif;color:#5a4e32;font-size:12px;">
  &copy; Vineyard Technologies &mdash; DaggerQuest
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function actionButton(url, label) {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0 8px;">
<tr><td align="center">
  <a href="${url}" style="display:inline-block;padding:12px 32px;background:linear-gradient(180deg,#3a2e14,#241c08);border:1px solid #5a4a28;border-radius:4px;color:#d4c28a;font-family:'Cinzel',Georgia,serif;font-size:15px;text-decoration:none;letter-spacing:2px;">${label}</a>
</td></tr>
</table>`;
}

/**
 * Callable: send a custom verification email.
 * Called from the client after account creation.
 */
exports.sendVerificationEmail = onCall(
    {
        maxInstances: 10,
        memory: "256MiB",
        timeoutSeconds: 15,
        region: "us-central1",
        cors: true,
        secrets: ["RESEND_API_KEY"],
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Must be signed in.");
        }

        const uid = request.auth.uid;
        const user = await getAuth().getUser(uid);
        if (user.emailVerified) return { sent: false, reason: "already-verified" };

        let link;
        try {
            link = await getAuth().generateEmailVerificationLink(user.email, {
                url: ACTION_URL,
            });
        } catch (err) {
            console.error("Failed to generate verification link:", err);
            throw new HttpsError("internal", "Failed to generate verification link.");
        }

        const html = emailTemplate(
            "Verify Your Email",
            `<p>Welcome to DaggerQuest! Please verify your email address to begin your adventure.</p>
             ${actionButton(link, "Verify Email")}
             <p style="font-size:13px;color:#6a5e3e;margin-top:16px;">If you didn't create this account, you can safely ignore this email.</p>`
        );

        try {
            await getResend().emails.send({
                from: "DaggerQuest <noreply@daggerquest.com>",
                to: user.email,
                subject: "Verify your DaggerQuest email",
                html,
            });
        } catch (err) {
            console.error("Resend API error:", err);
            throw new HttpsError("internal", "Failed to send verification email.");
        }

        return { sent: true };
    }
);

/**
 * Callable: send a custom password-reset email.
 * Called from the client when user clicks "Forgot password?".
 */
exports.sendResetEmail = onCall(
    {
        maxInstances: 10,
        memory: "256MiB",
        timeoutSeconds: 15,
        region: "us-central1",
        cors: true,
        secrets: ["RESEND_API_KEY"],
    },
    async (request) => {
        const email = request.data?.email;
        if (!email || typeof email !== "string") {
            throw new HttpsError("invalid-argument", "Email is required.");
        }

        let link;
        try {
            link = await getAuth().generatePasswordResetLink(email, {
                url: ACTION_URL,
            });
        } catch {
            // Don't reveal whether the account exists.
            return { sent: true };
        }

        const html = emailTemplate(
            "Reset Your Password",
            `<p>We received a request to reset the password for your DaggerQuest account.</p>
             ${actionButton(link, "Reset Password")}
             <p style="font-size:13px;color:#6a5e3e;margin-top:16px;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>`
        );

        await getResend().emails.send({
            from: "DaggerQuest <noreply@daggerquest.com>",
            to: email,
            subject: "Reset your DaggerQuest password",
            html,
        });

        return { sent: true };
    }
);

/**
 * Listens to Pub/Sub budget notifications and disables billing
 * when the cost exceeds the budget threshold.
 *
 * This will effectively shut down all paid services in the project.
 * Re-enable billing manually in the Google Cloud Console when ready.
 */
exports.enforceBudgetCap = onMessagePublished(
    {
        topic: "billing-alerts",
        maxInstances: 1,
        memory: "256MiB",
        timeoutSeconds: 30,
        region: "us-central1",
    },
    async (event) => {
        const data = JSON.parse(
            Buffer.from(event.data.message.data, "base64").toString()
        );

        // `costAmount` is the current spend, `budgetAmount` is your cap.
        if (data.costAmount <= data.budgetAmount) {
            console.log(
                `Budget OK: $${data.costAmount} / $${data.budgetAmount}`
            );
            return;
        }

        console.warn(
            `BUDGET EXCEEDED: $${data.costAmount} / $${data.budgetAmount} — disabling billing.`
        );

        // Check if billing is already disabled.
        const [info] = await billing.getProjectBillingInfo({ name: PROJECT_NAME });
        if (!info.billingEnabled) {
            console.log("Billing already disabled.");
            return;
        }

        // Disable billing on the project.
        await billing.updateProjectBillingInfo({
            name: PROJECT_NAME,
            projectBillingInfo: { billingAccountName: "" },
        });

        console.warn("Billing has been disabled for " + PROJECT_ID);
    }
);

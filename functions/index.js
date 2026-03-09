const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { beforeUserCreated, HttpsError } = require("firebase-functions/v2/identity");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { CloudBillingClient } = require("@google-cloud/billing");

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

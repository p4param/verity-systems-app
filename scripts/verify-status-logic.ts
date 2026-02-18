
import { getEffectiveDocumentStatus } from "../src/lib/dms/workflowEngine";
import { DocumentStatus } from "@prisma/client";

function test() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("Today is:", today.toISOString());

    // Case 1: Expiry today (should be APPROVED now)
    const doc1 = { status: DocumentStatus.APPROVED, expiryDate: today };
    const status1 = getEffectiveDocumentStatus(doc1 as any);
    console.log("Test 1 (Expiry Today):", status1 === "APPROVED" ? "PASS" : `FAIL (got ${status1})`);

    // Case 2: Expiry yesterday (should be EXPIRED)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const doc2 = { status: DocumentStatus.APPROVED, expiryDate: yesterday };
    const status2 = getEffectiveDocumentStatus(doc2 as any);
    console.log("Test 2 (Expiry Yesterday):", status2 === "EXPIRED" ? "PASS" : `FAIL (got ${status2})`);

    // Case 3: No expiry (should be APPROVED)
    const doc3 = { status: DocumentStatus.APPROVED, expiryDate: null };
    const status3 = getEffectiveDocumentStatus(doc3 as any);
    console.log("Test 3 (No Expiry):", status3 === "APPROVED" ? "PASS" : `FAIL (got ${status3})`);

    // Case 4: Future expiry (should be APPROVED)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const doc4 = { status: DocumentStatus.APPROVED, expiryDate: tomorrow };
    const status4 = getEffectiveDocumentStatus(doc4 as any);
    console.log("Test 4 (Expiry Tomorrow):", status4 === "APPROVED" ? "PASS" : `FAIL (got ${status4})`);
}

test();

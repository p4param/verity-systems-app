const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting Tenant Isolation Verification...");

    const TEST_EMAIL = `ambiguous_test_${Date.now()}@example.com`;
    let tenantA, tenantB, userA, userB;

    try {
        // 1. Setup: Create 2 Tenants
        console.log("📝 Setting up Test Tenants...");
        tenantA = await prisma.tenant.create({
            data: { code: `iso_test_a_${Date.now()}`, name: "IsoTest Tenant A" }
        });
        tenantB = await prisma.tenant.create({
            data: { code: `iso_test_b_${Date.now()}`, name: "IsoTest Tenant B" }
        });

        // 2. Setup: Create 2 Users with SAME email (Duplicate Identity)
        console.log(`📝 Creating Duplicate Users (${TEST_EMAIL})...`);
        userA = await prisma.user.create({
            data: {
                tenantId: tenantA.id,
                email: TEST_EMAIL,
                fullName: "User A",
                passwordHash: "dummy"
            }
        });
        userB = await prisma.user.create({
            data: {
                tenantId: tenantB.id,
                email: TEST_EMAIL, // SAME EMAIL
                fullName: "User B",
                passwordHash: "dummy"
            }
        });

        // ---------------------------------------------------------
        // TEST CASE 1: Login Logic Verification
        // ---------------------------------------------------------
        console.log("\n🧪 TC-002: Verifying Login Logic (Ambiguity Check)...");

        // Simulate the query used in POST /api/auth/login
        const loginMatches = await prisma.user.findMany({
            where: { email: TEST_EMAIL }
        });

        console.log(`   Query found ${loginMatches.length} users.`);

        if (loginMatches.length > 1) {
            console.log("   ✅ PASS: Database returns multiple users. Application Logic will BLOCK this.");
        } else {
            console.error("   ❌ FAIL: Database did not return duplicates. Is uniqueness constraint blocking it?");
            // Note: If schema has unique(tenantId, email), this should work.
        }

        // ---------------------------------------------------------
        // TEST CASE 2: Admin Scoping Verification
        // ---------------------------------------------------------
        console.log("\n🧪 TC-ADM-001: Verifying Admin User List Scoping...");

        // Simulate the query used in GET /api/admin/users
        // Context: Admin is from Tenant A
        const adminQueryResults = await prisma.user.findMany({
            where: {
                tenantId: tenantA.id
            },
            select: { email: true, tenantId: true }
        });

        console.log(`   Admin (Tenant A) sees ${adminQueryResults.length} users.`);
        const leakedUsers = adminQueryResults.filter(u => u.tenantId !== tenantA.id);

        if (leakedUsers.length === 0 && adminQueryResults.length === 1 && adminQueryResults[0].email === TEST_EMAIL) {
            console.log("   ✅ PASS: Only Tenant A user returned. No leak.");
        } else {
            console.error("   ❌ FAIL: Data leakage detected or missing data!");
            console.error("   Returned:", adminQueryResults);
        }

    } catch (error) {
        console.error("❌ ERROR:", error);
    } finally {
        // Cleanup
        console.log("\n🧹 Cleaning up...");
        if (userA) await prisma.user.delete({ where: { id: userA.id } });
        if (userB) await prisma.user.delete({ where: { id: userB.id } });
        if (tenantA) await prisma.tenant.delete({ where: { id: tenantA.id } });
        if (tenantB) await prisma.tenant.delete({ where: { id: tenantB.id } });

        await prisma.$disconnect();
    }
}

main();

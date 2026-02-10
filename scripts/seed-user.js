const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'test@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Checking Tenant...');
    // Find or Create Tenant
    let tenant = await prisma.tenant.findUnique({ where: { code: 'test-tenant' } });
    if (!tenant) {
        console.log('Creating tenant...');
        tenant = await prisma.tenant.create({
            data: {
                name: 'Test Tenant',
                code: 'test-tenant',
                isActive: true
            },
        });
    }
    console.log('Tenant ID:', tenant.id);

    console.log('Checking User...');
    // Find User
    let user = await prisma.user.findFirst({ where: { email } });
    if (user) {
        console.log('User exists, updating password...');
        // Update password to ensure we know it
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword, isActive: true, isLocked: false, status: 'ACTIVE' }
        });
    } else {
        console.log('Creating user...');
        user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                fullName: 'Test User',
                tenantId: tenant.id,
                isActive: true,
                status: 'ACTIVE'
            }
        });
    }

    console.log(`User ready: ${user.email}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

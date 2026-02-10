const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'adin@dms.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Ensuring Tenant...');
    let tenant = await prisma.tenant.findUnique({ where: { code: 'test-tenant' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: { name: 'Test Tenant', code: 'test-tenant', isActive: true }
        });
    }

    console.log('Ensuring Admin Role...');
    let adminRole = await prisma.role.findFirst({ where: { name: 'Admin' } });
    if (!adminRole) {
        adminRole = await prisma.role.create({
            data: {
                name: 'Admin',
                tenantId: tenant.id,
                description: 'Administrator'
            }
        });
    }

    console.log('Ensuring User...');
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                fullName: 'Admin User',
                tenantId: tenant.id,
                isActive: true,
                status: 'ACTIVE',
            }
        });
    } else {
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword, isActive: true, status: 'ACTIVE' }
        });
    }

    console.log('Assigning Role...');
    const existingAssignment = await prisma.userRole.findUnique({
        where: {
            userId_roleId: {
                userId: user.id,
                roleId: adminRole.id
            }
        }
    });

    if (!existingAssignment) {
        await prisma.userRole.create({
            data: {
                userId: user.id,
                roleId: adminRole.id,
            }
        });
    }

    console.log(`Admin user ready: ${user.email}`);

    // Validation
    const finalUser = await prisma.user.findFirst({
        where: { email },
        include: { userRoles: { include: { role: true } } }
    });
    console.log('Roles:', finalUser.userRoles.map(ur => ur.role.name));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

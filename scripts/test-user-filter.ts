import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testFilter() {
    console.log('--- Testing API Filter Logic ---');
    const permissionCode = 'DMS_DOCUMENT_APPROVE';

    const usersWithPermission = await prisma.user.findMany({
        where: {
            userRoles: {
                some: {
                    role: {
                        rolePermissions: {
                            some: {
                                permission: {
                                    code: permissionCode
                                }
                            }
                        }
                    }
                }
            }
        },
        select: {
            fullName: true,
            email: true,
            userRoles: {
                select: {
                    role: {
                        select: {
                            name: true,
                            rolePermissions: {
                                select: {
                                    permission: {
                                        select: {
                                            code: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log(`Found ${usersWithPermission.length} users with ${permissionCode}:`);
    usersWithPermission.forEach(u => {
        const roles = u.userRoles.map(ur => ur.role.name).join(', ');
        console.log(`- ${u.fullName} (${u.email}) [Roles: ${roles}]`);
    });

    const allUsers = await prisma.user.findMany({
        select: { fullName: true, email: true }
    });
    console.log(`\nTotal Users in DB: ${allUsers.length}`);
}

testFilter().finally(() => prisma.$disconnect());

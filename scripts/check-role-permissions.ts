import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Check Role Permissions...');

    const roleName = 'DMS Contributor';
    const role = await prisma.role.findFirst({
        where: { name: roleName },
        include: {
            rolePermissions: {
                include: {
                    permission: true
                }
            }
        }
    });

    if (!role) {
        console.error(`❌ Role '${roleName}' not found.`);
        return;
    }

    console.log(`Role: ${role.name} (${role.id})`);
    console.log('Permissions:');
    role.rolePermissions.forEach(rp => {
        console.log(` - ${rp.permission.code}`);
    });

    const hasFolderRead = role.rolePermissions.some(rp => rp.permission.code === 'DMS_FOLDER_READ');
    if (!hasFolderRead) {
        console.error(`❌ Missing permission: DMS_FOLDER_READ`);
    } else {
        console.log(`✅ Has permission: DMS_FOLDER_READ`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

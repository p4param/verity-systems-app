import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔒 Revoking DMS_DOCUMENT_WITHDRAW from DMS Contributor...');

    const roleName = 'DMS Contributor';
    const role = await prisma.role.findFirst({ where: { name: roleName } });

    if (!role) {
        console.error(`❌ Role ${roleName} not found.`);
        return;
    }

    const permCode = 'DMS_DOCUMENT_WITHDRAW';
    const permission = await prisma.permission.findUnique({ where: { code: permCode } });

    if (!permission) {
        console.error(`❌ Permission ${permCode} not found.`);
        return;
    }

    const deleted = await prisma.rolePermission.deleteMany({
        where: {
            roleId: role.id,
            permissionId: permission.id
        }
    });

    if (deleted.count > 0) {
        console.log(`✅ Revoked ${permCode} from ${roleName}.`);
    } else {
        console.log(`⚠️ Permission was not assigned to role.`);
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

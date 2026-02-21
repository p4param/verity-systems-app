import { PrismaClient } from '@prisma/client';
import { CommentService } from '../src/lib/dms/services/CommentService';

// Suppress logs
const prisma = new PrismaClient({ log: ['error'] });

async function main() {
    console.log('🧪 Testing Comment Service...');

    // 1. Get a document
    const doc = await prisma.document.findFirst({
        where: { status: 'DRAFT' },
        include: { tenant: true }
    });

    if (!doc) {
        console.error('❌ No DRAFT document found.');
        return;
    }
    console.log(`📄 Found Document: ${doc.title} (${doc.id})`);

    // 2. Get a user
    const user = await prisma.user.findFirst({
        where: { tenantId: doc.tenantId }
    });

    if (!user) {
        console.error('❌ No user found for tenant.');
        return;
    }
    console.log(`👤 Found User: ${user.fullName} (${user.id})`);

    // Mock AuthUser
    const authUser = {
        sub: user.id,
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roles: [],
        roleIds: [],
        permissions: [],
        mfaEnabled: false
    };

    // 3. Add Comment
    try {
        console.log('📝 Adding comment...');
        const comment = await CommentService.addComment(
            doc.id,
            doc.tenantId,
            authUser,
            "Script Test Comment " + Date.now()
        );
        console.log('✅ Comment added:', comment.id);
    } catch (e: any) {
        console.error('❌ Failed to add comment:', e.message);
    }

    // 4. Get Comments
    try {
        console.log('🔍 Fetching comments...');
        const comments = await CommentService.getComments(doc.id, doc.tenantId);
        console.log(`✅ Found ${comments.length} comments.`);
        if (comments.length > 0) {
            const last = comments[comments.length - 1];
            console.log(`  - Latest: [${last.user.fullName}] ${last.content}`);
        }
    } catch (e: any) {
        console.error('❌ Failed to fetch comments:', e.message);
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

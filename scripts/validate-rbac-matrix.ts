import { PrismaClient, DocumentStatus } from '@prisma/client';
import { getAvailableWorkflowActions } from '../src/lib/dms/ui-logic';
import { DmsWorkflowService } from '../src/services/dms/workflow-service';
import { AuthUser } from '../src/lib/auth/auth-types';

const prisma = new PrismaClient({ log: [] });

// Mock console.log to avoid spam during test
const originalLog = console.log;
// console.log = () => {}; 

async function main() {
    // Silence console during testing
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = () => { };
    console.warn = () => { };
    console.error = () => { };

    originalLog('🛡️ Starting RBAC Validation Matrix...');
    // process.env.DEBUG = ''; // Disable debug logs

    // 1. Setup Users
    const usersToTest = [
        'dms.admin@example.com',
        'dms.manager@example.com',
        'dms.contributor@example.com',
        'dms.viewer@example.com'
    ];

    const authUsers: Record<string, AuthUser> = {};

    for (const email of usersToTest) {
        const user = await prisma.user.findFirst({
            where: { email },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: {
                                    include: { permission: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            console.error(`❌ User ${email} not found.`);
            continue;
        }

        const permissions = new Set<string>();
        const roleIds: number[] = [];
        const roles: string[] = [];

        user.userRoles.forEach(ur => {
            roles.push(ur.role.name);
            roleIds.push(ur.role.id);
            ur.role.rolePermissions.forEach(rp => {
                permissions.add(rp.permission.code);
            });
        });

        authUsers[email] = {
            sub: user.id,
            id: user.id,
            tenantId: user.tenantId,
            email: user.email,
            roles: roles,
            roleIds: roleIds,
            permissions: Array.from(permissions),
            mfaEnabled: user.mfaEnabled,
        };
    }

    // 2. Fetch Test Documents
    const documents = await prisma.document.findMany({
        where: {
            folder: {
                name: { startsWith: 'RBAC_' }
            }
        },
        include: { folder: true }
    });

    if (documents.length === 0) {
        console.error('❌ No test documents found. Run scripts/seed-rbac-test-data.ts first.');
        process.exit(1);
    }

    // 3. Define Actions to Test
    const actions = ['submit', 'approve', 'reject', 'withdraw', 'revise', 'obsolete'];

    // 4. Matrix Generation
    // Format: | Role | Status | Folder ACL | Action | UI Visible? | API Allowed? | Result |

    const results: any[] = [];

    for (const email of usersToTest) {
        const user = authUsers[email];
        if (!user) continue;

        const roleName = user.roles[0]; // Assuming single role for test users

        for (const doc of documents) {
            // Only test Contributor for the CREATOR scenario to keep output clean and proof-oriented
            if (email !== 'dms.contributor@example.com') continue;
            if (!doc.title.includes('SUBMITTED_ByContributor')) continue;

            const folderName = doc.folder?.name || 'Unknown';
            const aclType = folderName.replace('RBAC_', '').replace('TEST_ROOT', 'ROOT');
            const status = doc.status;
            const isCreator = doc.createdById === user.sub;

            for (const action of actions) {
                // A. UI Check (Simulation of new effective permission logic)
                const { PermissionService } = require('../src/lib/dms/services/PermissionService');
                const effectivePermissions = await PermissionService.getEffectivePermissions(user, doc.folderId);
                const uiActions = getAvailableWorkflowActions(status, effectivePermissions, isCreator);
                const isUiVisible = uiActions.some(a => a.action === action);

                // B. Backend Check (Simulation via Rollback)
                let apiAllowed = false;
                let apiResult = 'Denied';

                try {
                    // Use a transaction that we ALWAYS rollback
                    await prisma.$transaction(async (tx) => {
                        // We need to inject the transaction client into DmsWorkflowService/transitionDocumentStatus
                        // But DmsWorkflowService imports 'prisma' directly usually, OR accepts it?
                        // verify DmsWorkflowService.executeAction signature.
                        // It calls `transitionDocumentStatus(prisma, ...)`
                        // Wait, `transitionDocumentStatus` takes `prisma` as first arg.
                        // But `DmsWorkflowService.executeAction` calls it with `const { transitionDocumentStatus } = ...`
                        // and passes `prisma` (the global one).
                        // I NEED to bypass DmsWorkflowService and call transitionDocumentStatus directly with `tx`
                        // to ensure it uses the transaction.
                        // OR update DmsWorkflowService to accept prisma client.

                        // For this test script, I will import transitionDocumentStatus directly.
                        const { transitionDocumentStatus } = require('../src/lib/dms/workflowEngine');

                        // BUT, ReviewService also uses global prisma.
                        // If I test 'submit' with reviewers, I'm stuck if I can't inject tx.
                        // For standard actions, transitionDocumentStatus is enough.

                        await transitionDocumentStatus(
                            tx,
                            doc.id,
                            user.tenantId,
                            action,
                            user
                        );

                        apiAllowed = true;
                        apiResult = 'Allowed';

                        throw new Error('ROLLBACK_TEST');
                    });
                } catch (e: any) {
                    if (e.message === 'ROLLBACK_TEST') {
                        // Success!
                        apiAllowed = true;
                        apiResult = 'Allowed';
                    } else {
                        // Real error = Denied
                        apiAllowed = false;
                        apiResult = e.message || 'Error';
                        // Map common errors to readable strings
                        if (apiResult.includes('Record to update not found')) apiResult = 'Not Found/Access Denied';
                        if (e.code === 'P2002') apiResult = 'Constraint Violation';
                        if (e.name === 'UnauthorizedWorkflowActionError') apiResult = 'Unauthorized Action';
                        if (e.name === 'InvalidWorkflowActionError') apiResult = 'Invalid Action';
                        if (e.name === 'TransitionError') apiResult = 'Invalid Transition';
                    }
                }

                results.push({
                    Role: roleName,
                    Status: status,
                    FolderACL: aclType,
                    Action: action,
                    UI_Visible: isUiVisible,
                    API_Allowed: apiAllowed,
                    Result: apiResult
                });
            }
        }
    }

    // 5. Final Output
    originalLog('\n### RBAC Validation Results (Contributor as Creator in SUBMITTED status)\n');
    originalLog('| Role | Status | Folder ACL | Action | UI Visible | API Allowed | Details |');
    originalLog('|------|--------|------------|--------|------------|-------------|---------|');
    results.forEach(r => {
        const ui = r.UI_Visible ? '✅' : '❌';
        const api = r.API_Allowed ? '✅' : '❌';
        originalLog(`| ${r.Role} | ${r.Status} | ${r.FolderACL} | ${r.Action} | ${ui} | ${api} | ${r.Result} |`);
    });
}

main()
    .catch((e) => {
        // Use a hidden console here if needed, but we want to see errors
        process.stdout.write(e.stack + '\n');
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

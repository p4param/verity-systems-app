import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermission } from "@/lib/auth/permission-guard"
import { createAuditLog } from "@/lib/audit"
import crypto from "crypto"

export async function GET(req: Request) {
    try {
        const currentUser = await requirePermission(req, "USER_VIEW")

        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const skip = (page - 1) * limit

        const users = await prisma.user.findMany({
            where: {
                tenantId: currentUser.tenantId
            },
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                fullName: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                passwordHash: true,
                userRoles: {
                    where: {
                        role: { tenantId: currentUser.tenantId }  // Filter roles by tenant
                    },
                    include: {
                        role: true
                    }
                }
            },
            orderBy: {
                email: "asc"
            }
        })

        const mappedUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            isActive: u.isActive,
            lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt,
            status: !u.passwordHash ? "PENDING" : (u.isActive ? "ACTIVE" : "DISABLED"),
            roles: u.userRoles.map(ur => ur.role.name)
        }))

        return NextResponse.json(mappedUsers)
    } catch (error) {
        if (error instanceof Response) return error
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function POST(req: Request) {
    try {
        // 1. Require admin authentication
        const admin = await requirePermission(req, "USER_CREATE")

        // 2. Parse request body
        const { email, fullName, roleIds } = await req.json()

        // Validate input
        if (!email || !fullName) {
            return NextResponse.json(
                { message: "Email and full name are required" },
                { status: 400 }
            )
        }

        if (!Array.isArray(roleIds) || roleIds.length === 0) {
            return NextResponse.json(
                { message: "At least one role must be assigned" },
                { status: 400 }
            )
        }

        // 3. Check if user already exists in this tenant
        const existingUser = await prisma.user.findUnique({
            where: {
                tenantId_email: {
                    tenantId: admin.tenantId,
                    email: email
                }
            }
        })

        if (existingUser) {
            return NextResponse.json(
                { message: "User with this email already exists in your tenant" },
                { status: 409 }
            )
        }

        // 4. Generate cryptographically secure invite token
        const inviteToken = crypto.randomBytes(32).toString("hex")
        const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex")

        // 5. Create user and invite in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user with PENDING status logic (invite only)
            const newUser = await tx.user.create({
                data: {
                    tenantId: admin.tenantId,
                    email: email,
                    fullName: fullName,
                    // status field removed as it does not exist in schema
                    passwordHash: null,
                    createdBy: admin.sub
                }
            })

            // Assign initial roles
            await tx.userRole.createMany({
                data: roleIds.map((roleId: number) => ({
                    userId: newUser.id,
                    roleId: roleId,
                    assignedBy: admin.sub
                }))
            })

            // Store invite token
            const invite = await tx.userInvite.create({
                data: {
                    tenantId: admin.tenantId,
                    email: email,
                    tokenHash: tokenHash,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    createdBy: admin.sub
                }
            })

            // Log audit event
            await createAuditLog({
                tenantId: admin.tenantId,
                actorUserId: admin.sub,
                targetUserId: newUser.id,
                action: "USER.CREATE",
                details: JSON.stringify({
                    email: email,
                    fullName: fullName,
                    roleIds: roleIds,
                    inviteId: invite.id,
                    method: "admin_invite"
                }),
                ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
            }, tx)

            return { user: newUser, invite, inviteToken }
        })

        // 6. Log invite link to console (until email functionality is available)
        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/activate?token=${result.inviteToken}`

        console.log('\n' + '='.repeat(80))
        console.log('📧 USER INVITE - Email functionality not yet implemented')
        console.log('='.repeat(80))
        console.log(`To: ${result.user.email}`)
        console.log(`Name: ${result.user.fullName}`)
        console.log(`Status: PENDING`)
        console.log(`Expires: ${result.invite.expiresAt.toISOString()}`)
        console.log('\n🔗 Activation Link (valid for 24 hours):')
        console.log(activationLink)
        console.log('='.repeat(80) + '\n')

        // 7. Return success response
        return NextResponse.json({
            message: "User invited successfully",
            user: {
                id: result.user.id,
                email: result.user.email,
                fullName: result.user.fullName,
                status: "PENDING" // Explicitly return PENDING for new invites
            },
            // Note: In production, inviteToken should NEVER be returned in the response
            // It should only be sent via email
            expiresAt: result.invite.expiresAt
        }, { status: 201 })

    } catch (error) {
        if (error instanceof Response) return error

        console.error("[USER_CREATE_ERROR]", error)

        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}

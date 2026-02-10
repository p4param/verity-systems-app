import { prisma } from "@/lib/prisma"

export async function cleanupAuthTokens() {
    const now = new Date()

    // 1️⃣ Cleanup password reset tokens
    const resetResult = await prisma.passwordResetToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: now } },
                { usedAt: { not: null } }
            ]
        }
    })

    // 2️⃣ Cleanup refresh tokens (THIS IS THE CODE YOU ASKED ABOUT)
    const refreshResult = await prisma.refreshToken.deleteMany({
        where: {
            OR: [
                { expiresAt: { lt: now } },
                { revokedAt: { not: null } }
            ]
        }
    })

    return {
        passwordResetTokensDeleted: resetResult.count,
        refreshTokensDeleted: refreshResult.count
    }
}

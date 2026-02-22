import { LegalHoldService } from '../legal-hold-service'
import { LegalHoldViolationError } from '@/lib/dms/errors'
import { prisma } from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
    prisma: {
        legalHold: {
            findMany: jest.fn(),
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        document: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        legalHoldTarget: {
            createMany: jest.fn(),
            findMany: jest.fn(),
        },
        folder: {
            findUnique: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback(prisma)),
    },
}))

// Mock AuditService
jest.mock('../../audit-service', () => ({
    AuditService: {
        logEvent: jest.fn(),
    },
}))

describe('LegalHoldService', () => {
    const tenantId = 1
    const userId = 'user-1'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('assertNotUnderLegalHold', () => {
        it('should throw LegalHoldViolationError if document is under legal hold', async () => {
            ; (prisma.document.findUnique as jest.Mock).mockResolvedValue({
                id: 'doc-1',
                isUnderLegalHold: true,
            })

            await expect(LegalHoldService.assertNotUnderLegalHold(tenantId, 'doc-1'))
                .rejects.toThrow(LegalHoldViolationError)
        })

        it('should not throw if document is not under legal hold', async () => {
            ; (prisma.document.findUnique as jest.Mock).mockResolvedValue({
                id: 'doc-2',
                isUnderLegalHold: false,
            })

            await expect(LegalHoldService.assertNotUnderLegalHold(tenantId, 'doc-2'))
                .resolves.not.toThrow()
        })
    })

    describe('createHold', () => {
        it('should create a legal hold and log audit event', async () => {
            const mockHold = {
                id: 'hold-1',
                name: 'Test Hold',
                tenantId,
                isActive: true,
            }
                ; (prisma.legalHold.create as jest.Mock).mockResolvedValue(mockHold)

            const result = await LegalHoldService.createHold(tenantId, userId, {
                name: 'Test Hold',
                reason: 'Investigation',
                startDate: new Date(),
            })

            expect(prisma.legalHold.create).toHaveBeenCalled()
            expect(result).toEqual(mockHold)
        })
    })

    describe('attachTargets', () => {
        it('should attach a document target and update its status', async () => {
            ; (prisma.legalHold.findUnique as jest.Mock).mockResolvedValue({ id: 'hold-1', tenantId })

            await LegalHoldService.attachTargets(tenantId, 'hold-1', [
                { type: 'DOCUMENT', id: 'doc-1' }
            ])

            expect(prisma.legalHoldTarget.createMany).toHaveBeenCalled()
            expect(prisma.document.update).toHaveBeenCalledWith({
                where: { id: 'doc-1', tenantId },
                data: { isUnderLegalHold: true }
            })
        })
    })
})

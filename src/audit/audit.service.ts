import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { User, UserRole } from '../entities/user.entity';

export interface AuditLogData {
    tableName: string;
    recordId: string;
    action: 'LOGIN' | 'LOGOUT' | 'GOOGLE_LOGIN' | 'PASSWORD_CHANGE' | 'PASSWORD_FORGOT' | 'PASSWORD_RESET' | 'USER_CREATE' | 'CREATE' | 'UPDATE' | 'DELETE';
    oldValues?: any;
    newValues?: any;
    changedByUserId: string;
    changeReason?: string;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectRepository(AuditLog)
        private auditLogRepository: Repository<AuditLog>,
        @InjectRepository(User)
        private userRepository: Repository<User>
    ) {}

    async logAdminAction(data: AuditLogData): Promise<void> {
        try {
            // Fetch user email for the audit log
            // Try to find by UUID first, then by Firebase UID if UUID fails
            let user: User | null = null;
            
            // Check if the changedByUserId looks like a UUID (contains hyphens)
            if (data.changedByUserId.includes('-')) {
                user = await this.userRepository.findOne({
                    where: { id: data.changedByUserId },
                    select: ['id', 'email']
                });
            }

            if (!user) {
                user = await this.userRepository.findOne({
                    where: { firebase_uid: data.changedByUserId },
                    select: ['id', 'email']
                });
            }

            const auditLog = new AuditLog();
            auditLog.table_name = data.tableName;
            auditLog.record_id = data.recordId;
            auditLog.action = data.action;
            auditLog.old_values = data.oldValues || null;
            auditLog.new_values = data.newValues || null;
            auditLog.changed_by_user_id = data.changedByUserId;
            auditLog.changed_by_user_email = user?.email || null;
            auditLog.change_reason = data.changeReason || '';
            auditLog.ip_address = data.ipAddress || '';
            auditLog.user_agent = data.userAgent || '';

            await this.auditLogRepository.save(auditLog);
            
            this.logger.log(`🔍 ADMIN AUDIT: ${data.action} by ${user?.email || data.changedByUserId}`, {
                table: data.tableName,
                recordId: data.recordId,
                reason: data.changeReason,
                ip: data.ipAddress
            });

        } catch (error) {
            this.logger.error('Failed to create audit log:', error);
        }
    }

    // Helper method to extract request metadata
    getRequestMetadata(req: any): { ipAddress?: string; userAgent?: string } {
        return {
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        };
    }

    // Get audit logs with filtering and role-based access
    async getAuditLogs(filters: {
        action?: string;
        tableName?: string;
        changedByUserId?: string;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }, currentUser: User): Promise<{ logs: AuditLog[]; total: number }> {
        const query = this.auditLogRepository.createQueryBuilder('audit');

        // Apply role-based filtering
        await this.applyRoleBasedFiltering(query, currentUser);

        if (filters.action) {
            query.andWhere('audit.action = :action', { action: filters.action });
        }

        if (filters.tableName) {
            query.andWhere('audit.table_name = :tableName', { tableName: filters.tableName });
        }

        if (filters.changedByUserId) {
            query.andWhere('audit.changed_by_user_id = :userId', { userId: filters.changedByUserId });
        }

        if (filters.search) {
            query.andWhere(
                '(audit.action ILIKE :search OR audit.changed_by_user_email ILIKE :search)',
                { search: `%${filters.search}%` }
            );
        }

        if (filters.startDate) {
            query.andWhere('audit.created_at >= :startDate', { startDate: filters.startDate });
        }

        if (filters.endDate) {
            query.andWhere('audit.created_at <= :endDate', { endDate: filters.endDate });
        }

        const total = await query.getCount();

        if (filters.limit !== undefined) {
            query.limit(filters.limit);
        }

        if (filters.offset !== undefined) {
            query.offset(filters.offset);
        }

        const logs = await query
            .orderBy('audit.created_at', 'DESC')
            .getMany();

        return { logs, total };
    }

    async clearAllAuditLogs(): Promise<{ cleared: number }> {
        const result = await this.auditLogRepository.createQueryBuilder()
            .delete()
            .execute();

        return { cleared: result.affected ?? 0 };
    }

    async deleteAuditLog(id: string, currentUser: User): Promise<{ deleted: number }> {
        const auditLog = await this.auditLogRepository.findOne({ where: { id } });

        if (!auditLog) {
            throw new NotFoundException('Audit log not found');
        }

        if (currentUser.role === UserRole.ADMIN) {
            const result = await this.auditLogRepository.delete(id);
            return { deleted: result.affected ?? 0 };
        }

        const allowedUserIds = await this.getAllowedUserIdsForRole(currentUser);
        if (!allowedUserIds.includes(auditLog.changed_by_user_id)) {
            throw new ForbiddenException('You do not have permission to delete this audit log');
        }

        if (auditLog.is_deleted) {
            return { deleted: 0 };
        }

        const deletedByRole = currentUser.role ?? (currentUser['roleEntity']?.role_name ?? null);
        const result = await this.auditLogRepository.update(id, {
            is_deleted: true,
            deleted_by_user_id: currentUser.id,
            deleted_by_user_email: currentUser.email,
            deleted_by_user_role: deletedByRole,
            deleted_at: new Date()
        });

        return { deleted: result.affected ?? 0 };
    }

    async clearAuditLogs(currentUser: User): Promise<{ cleared: number }> {
        if (currentUser.role === UserRole.ADMIN) {
            return this.clearAllAuditLogs();
        }

        const allowedUserIds = await this.getAllowedUserIdsForRole(currentUser);
        if (allowedUserIds.length === 0) {
            return { cleared: 0 };
        }

        const deletedByRole = currentUser.role ?? (currentUser['roleEntity']?.role_name ?? null);
        const result = await this.auditLogRepository.createQueryBuilder()
            .update(AuditLog)
            .set({
                is_deleted: true,
                deleted_by_user_id: currentUser.id,
                deleted_by_user_email: currentUser.email,
                deleted_by_user_role: deletedByRole,
                deleted_at: new Date()
            })
            .where('changed_by_user_id IN (:...userIds)', { userIds: allowedUserIds })
            .andWhere('is_deleted = false')
            .execute();

        return { cleared: result.affected ?? 0 };
    }

    private getUserIdentifiers(user: User): string[] {
        const ids = [user.id];
        if (user.firebase_uid) {
            ids.push(user.firebase_uid);
        }
        return ids.filter(Boolean);
    }

    private async getSubUserIdentifiers(parentId: string): Promise<string[]> {
        const subUsers = await this.userRepository.find({
            where: { parent_id: parentId },
            select: ['id', 'firebase_uid']
        });

        return subUsers.reduce((acc: string[], subUser) => {
            acc.push(subUser.id);
            if (subUser.firebase_uid) {
                acc.push(subUser.firebase_uid);
            }
            return acc;
        }, []);
    }

    private async getAllowedUserIdsForRole(currentUser: User): Promise<string[]> {
        const ownIds = this.getUserIdentifiers(currentUser);

        switch (currentUser.role) {
            case UserRole.CITY_INSPECTOR:
            case UserRole.INSURANCE_COMPANY:
            case UserRole.CONTRACTOR: {
                const subUserIds = await this.getSubUserIdentifiers(currentUser.id);
                return [...ownIds, ...subUserIds];
            }
            default:
                return ownIds;
        }
    }

    private async applyRoleBasedFiltering(query: any, currentUser: User): Promise<void> {
        if (currentUser.role !== UserRole.ADMIN) {
            query.andWhere('audit.is_deleted = false');
        }

        switch (currentUser.role) {
            case UserRole.ADMIN:
                // Admin can see all logs - no filtering needed
                break;

            case UserRole.CITY_INSPECTOR:
                // Main city inspector - can see their own logs and sub-users' logs
                const cityAllowedUserIds = [
                    ...this.getUserIdentifiers(currentUser),
                    ...(await this.getSubUserIdentifiers(currentUser.id))
                ];
                query.andWhere('audit.changed_by_user_id IN (:...userIds)', { userIds: cityAllowedUserIds });
                break;

            case UserRole.INSURANCE_COMPANY:
                // Main insurance company - can see their own logs and sub-users' logs
                const insuranceAllowedUserIds = [
                    ...this.getUserIdentifiers(currentUser),
                    ...(await this.getSubUserIdentifiers(currentUser.id))
                ];
                query.andWhere('audit.changed_by_user_id IN (:...userIds)', { userIds: insuranceAllowedUserIds });
                break;

            case UserRole.CONTRACTOR:
                // Main contractor - can see their own logs and sub-users' logs
                const contractorAllowedUserIds = [
                    ...this.getUserIdentifiers(currentUser),
                    ...(await this.getSubUserIdentifiers(currentUser.id))
                ];
                query.andWhere('audit.changed_by_user_id IN (:...userIds)', { userIds: contractorAllowedUserIds });
                break;

            default:
                // Other roles can only see their own logs
                query.andWhere('audit.changed_by_user_id IN (:...userIds)', {
                    userIds: this.getUserIdentifiers(currentUser)
                });
                break;
        }
    }
}


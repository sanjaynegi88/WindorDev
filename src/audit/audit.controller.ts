import { Controller, Get, Delete, Param, Query, UseGuards, Req, ParseIntPipe, ParseDatePipe, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { AuditService } from './audit.service';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/audit-logs')
@UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CITY_INSPECTOR, UserRole.INSURANCE_COMPANY, UserRole.CONTRACTOR)
export class AuditController {
    constructor(private readonly auditService: AuditService) {}

    @Get()
    async getAuditLogs(
        @Query('action') action?: string,
        @Query('table_name') tableName?: string,
        @Query('changed_by_user_id') changedByUserId?: string,
        @Query('search') search?: string,
        @Query('start_date') startDate?: string,
        @Query('end_date') endDate?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('offset') offsetQuery?: string,
        @Req() req?: any
    ) {
        // Block sub-users from accessing audit logs
        if (req.user.sub_account) {
            throw new ForbiddenException('Sub-accounts cannot access audit logs');
        }

        // Validate UUID if provided
        if (changedByUserId) {
            validateUUID(changedByUserId, 'changed_by_user_id');
        }

        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        const offsetNum = offsetQuery ? parseInt(offsetQuery, 10) : (limitNum ? (pageNum - 1) * limitNum : 0);

        const filters = {
            action,
            tableName,
            changedByUserId,
            search,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: limitNum,
            offset: offsetNum
        };

        const { logs, total } = await this.auditService.getAuditLogs(filters, req.user);

        return {
            data: logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
                hasMore: limitNum ? (filters.offset + limitNum) < total : false
            },
            message: `Retrieved ${logs.length} audit logs`
        };
    }

    @Get('actions')
    async getAvailableActions(@Req() req?: any) {
        // Block sub-users from accessing audit logs
        if (req.user.sub_account) {
            throw new ForbiddenException('Sub-accounts cannot access audit logs');
        }

        return {
            data: [
                'LOGIN',
                'LOGOUT',
                'GOOGLE_LOGIN',
                'PASSWORD_CHANGE',
                'PASSWORD_FORGOT',
                'PASSWORD_RESET',
                'USER_CREATE',
                'CREATE',
                'UPDATE',
                'DELETE'
            ],
            message: 'Available audit log actions'
        };
    }

    @Get('tables')
    async getAvailableTables(@Req() req?: any) {
        // Block sub-users from accessing audit logs
        if (req.user.sub_account) {
            throw new ForbiddenException('Sub-accounts cannot access audit logs');
        }

        return {
            data: [
                'users',
                'properties',
                'brands',
                'cities',
                'states',
                'membership_plans',
                'insurance_companies',
                'auth_events'
            ],
            message: 'Available audit log tables'
        };
    }

    @Delete('clear')
    async clearAuditLogs(@Req() req?: any) {
        // Block sub-users from accessing audit logs
        if (req.user.sub_account) {
            throw new ForbiddenException('Sub-accounts cannot access audit logs');
        }

        const result = await this.auditService.clearAuditLogs(req.user);
        return {
            data: result,
            message: `Cleared ${result.cleared} audit log${result.cleared === 1 ? '' : 's'}`
        };
    }

    @Delete(':id')
    async deleteAuditLog(@Param('id') id: string, @Req() req?: any) {
        // Block sub-users from accessing audit logs
        if (req.user.sub_account) {
            throw new ForbiddenException('Sub-accounts cannot access audit logs');
        }

        validateUUID(id, 'audit log id');

        const result = await this.auditService.deleteAuditLog(id, req.user);
        return {
            data: result,
            message: result.deleted
                ? 'Audit log deleted'
                : 'Audit log was already deleted'
        };
    }
}
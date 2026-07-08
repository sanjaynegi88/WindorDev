import { 
    Controller, 
    Get, 
    Put, 
    Delete, 
    Param, 
    Body,
    Post,
    UseGuards, 
    Req,
    BadRequestException 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/notifications')
@UseGuards(AuthGuard('firebase-jwt'))
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService
    ) {}

    @Get('my')
    async getMyNotifications(@Req() req: any) {
        const notifications = await this.notificationsService.findMyNotifications(req.user.id);
        return {
            data: notifications,
            message: `Found ${notifications.length} notifications`,
            total: notifications.length
        };
    }

    @Get('unread-count')
    async getUnreadCount(@Req() req: any) {
        const count = await this.notificationsService.getUnreadCount(req.user.id);
        return {
            data: { count },
            message: 'Unread count retrieved successfully'
        };
    }



    @Delete('bulk')
    async bulkDelete(@Body() body: { ids?: string[] }, @Req() req: any) {
        if (!body || !body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
            throw new BadRequestException('No notification IDs provided for bulk deletion. Please provide an array of notification IDs in the request body.');
        }
        
        body.ids.forEach(id => validateUUID(id, 'notification id'));
        
        const result = await this.notificationsService.bulkDelete(body.ids, req.user.id);
        
        if (result.deletedCount === 0) {
            throw new BadRequestException({
                message: 'No notifications were deleted',
                error: 'NOTIFICATIONS_NOT_FOUND'
            });
        }
        
        const response: any = {
            message: `${result.deletedCount} notification${result.deletedCount === 1 ? '' : 's'} deleted successfully`,
            deletedCount: result.deletedCount
        };
        
        if (result.notFoundIds.length > 0) {
            response.warning = `${result.notFoundIds.length} notification${result.notFoundIds.length === 1 ? '' : 's'} not found or already deleted`;
            response.notFoundIds = result.notFoundIds;
        }
        
        return response;
    }

    @Get(':id')
    async getNotification(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'notification id');
        const notification = await this.notificationsService.findOne(id, req.user.id);
        return {
            data: notification,
            message: 'Notification retrieved successfully'
        };
    }

    @Put(':id/read')
    async markAsRead(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'notification id');
        const notification = await this.notificationsService.markAsRead(id, req.user.id);
        return {
            data: notification,
            message: 'Notification marked as read'
        };
    }

    @Delete(':id')
    async deleteNotification(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'notification id');
        await this.notificationsService.delete(id, req.user.id);
        return {
            message: 'Notification deleted successfully'
        };
    }
}
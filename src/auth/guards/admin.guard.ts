import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../entities/user.entity';

@Injectable()
export class AdminAccessGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const { user } = context.switchToHttp().getRequest();

        if (!user || user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Access denied: Admins only');
        }

        return true;
    }
}

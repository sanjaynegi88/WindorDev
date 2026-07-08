import { Controller, Get, Param, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { FormsService } from './forms.service';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/forms')
export class FormsController {
    constructor(private readonly formsService: FormsService) {}

    @Get(':userId')
    async getForm(
        @Param('userId') userId: string,
        @Res() res: any
    ) {
        validateUUID(userId, 'user id');
        const form = await this.formsService.getFormByUserId(userId);
        if (!form) {
            return res.status(HttpStatus.NOT_FOUND).json({
                message: 'No onboarding form found for this user.',
                requiresOnboarding: true
            });
        }
        return res.status(HttpStatus.OK).json({
            data: form
        });
    }
}

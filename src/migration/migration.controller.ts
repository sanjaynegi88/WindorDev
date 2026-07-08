import { Controller, Post, Res, HttpStatus } from '@nestjs/common';
import { MigrationService } from './migration.service';
import type { Response } from 'express';

@Controller('api/migrate')
export class MigrationController {
    constructor(private readonly migrationService: MigrationService) { }

    @Post()
    async migrate(@Res() res: Response) {
        try {
            const result = await this.migrationService.runMigrations();
            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: err.message,
                error: 'Migration failed'
            });
        }
    }

    @Post('reset')
    async reset(@Res() res: Response) {
        try {
            const result = await this.migrationService.resetMigrations();
            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                message: err.message,
                error: 'Reset failed'
            });
        }
    }
}
import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
    catch(exception: MulterError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let message = 'File upload error';

        if (exception.code === 'LIMIT_UNEXPECTED_FILE') {
            message = `Only one ${exception.field} is allowed`;
        } else if (exception.code === 'LIMIT_FILE_COUNT') {
            message = `Too many files uploaded for field: ${exception.field}`;
        } else if (exception.code === 'LIMIT_FILE_SIZE') {
            message = 'You can only upload up to 2 MB';
        }

        response.status(400).json({
            statusCode: 400,
            error: 'Bad Request',
            message,
        });
    }
}

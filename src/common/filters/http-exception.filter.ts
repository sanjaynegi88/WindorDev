import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Intercept 413 Payload Too Large errors
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      return response.status(413).json({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'You can only upload up to 2 MB',
      });
    }

    // Pass through other HTTP exceptions unchanged
    response.status(status).json(exceptionResponse);
  }
}

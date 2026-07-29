import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.extractMessage(exception, statusCode);

    response.status(statusCode).json({ statusCode, message });
  }

  private extractMessage(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') return body;
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const { message } = body as { message: string | string[] };
        return Array.isArray(message) ? message.join(', ') : message;
      }
      return exception.message;
    }
    if (statusCode >= 500) return 'Unexpected server error';
    return 'Unexpected error';
  }
}

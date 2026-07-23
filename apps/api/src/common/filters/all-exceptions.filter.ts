import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { Request, Response } from "express"
import { STATUS_CODES } from "http"

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = "Internal Server Error"
    const isHttp = exception instanceof HttpException

    if (isHttp) {
      status = exception.getStatus()
      message = this.flatten(exception.getResponse())
    } else if (exception instanceof Error) {
      message = exception.message
      status = this.statusFromError(exception) ?? status
    }

    const isProduction = process.env.NODE_ENV === "production"
    if (isProduction && !isHttp) {
      message = STATUS_CODES[status] ?? "Internal Server Error"
    }

    this.logger.error({
      requestId: (req as unknown as { id?: string }).id,
      status,
      method: req.method,
      url: req.url,
      msg: exception instanceof Error ? exception.message : String(exception),
    })

    res.status(status).json({ message, data: null })
  }

  /**
   * Middleware installed via app.use() (e.g. Express's body-parser, which
   * throws PayloadTooLargeError for oversized bodies) raises plain Errors
   * carrying an http-errors-style `status`/`statusCode`, not HttpException.
   * Surface that real status instead of collapsing every non-Nest error to 500.
   */
  private statusFromError(error: Error): number | undefined {
    const candidate =
      (error as { status?: unknown; statusCode?: unknown }).status ??
      (error as { statusCode?: unknown }).statusCode
    if (typeof candidate === "number" && candidate >= 400 && candidate < 600) {
      return candidate
    }
    return undefined
  }

  private flatten(body: unknown): string {
    if (typeof body === "string") return body
    if (body && typeof body === "object" && "message" in body) {
      const m = (body as { message: unknown }).message
      if (Array.isArray(m)) return m.join("; ")
      if (typeof m === "string") return m
    }
    return "Error"
  }
}

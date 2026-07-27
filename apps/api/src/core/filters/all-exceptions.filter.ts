import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { STATUS_CODES } from "http"

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly config: ConfigService) {}

  /**
   * Writes the error envelope `{ message, data: null, request_id }`. Prisma P2025 becomes 404
   * before the generic non-HttpException path, class-validator message arrays are joined with
   * "; ", and in production non-HttpException messages are replaced by generic status text.
   */
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
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      exception.code === "P2025"
    ) {
      // Central net for bare .update()/.delete() on rows that vanished between a guard's
      // existence check and the write. Services with better messages throw their own
      // NotFoundException first; this only stops the raw-500 fallthrough.
      status = HttpStatus.NOT_FOUND
      message = "Not found"
    } else if (exception instanceof Error) {
      message = exception.message
      status = this.statusFromError(exception) ?? status
    }

    const isProduction = this.config.get<string>("NODE_ENV") === "production"
    if (isProduction && !isHttp) {
      message = STATUS_CODES[status] ?? "Internal Server Error"
    }

    const requestId = (req as unknown as { id?: string }).id
    this.logger.error(
      {
        requestId,
        status,
        method: req.method,
        url: req.url,
        msg: exception instanceof Error ? exception.message : String(exception),
      },
      !isHttp && exception instanceof Error ? exception.stack : undefined,
    )

    res.status(status).json({ message, data: null, request_id: requestId ?? null })
  }

  /**
   * Middleware installed via app.use() (e.g. body-parser's PayloadTooLargeError) raises plain
   * Errors carrying an http-errors-style `status`/`statusCode`, not HttpException. Surface that
   * real status instead of collapsing every non-Nest error to 500.
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

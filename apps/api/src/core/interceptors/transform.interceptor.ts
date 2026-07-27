import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
import { Observable } from "rxjs"
import { map } from "rxjs/operators"
import { Envelope, Payload } from "@shared/dto/response.types"

function isPayload(value: unknown): value is Payload<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    ("data" in value || "message" in value || "pagination" in value)
  )
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  /**
   * Normalizes a handler's return value into `{ message, data, pagination? }`. An object already
   * carrying `data`, `message` or `pagination` is treated as the payload; anything else becomes
   * `data`. `message` defaults to "OK" and `data` to null, and `request_id` is never added here.
   */
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((value): Envelope<T> => {
        if (isPayload(value)) {
          const envelope: Envelope<T> = {
            message: value.message ?? "OK",
            data: (value.data ?? null) as T | null,
          }
          if (value.pagination !== undefined) {
            envelope.pagination = value.pagination
          }
          return envelope
        }
        return { message: "OK", data: (value ?? null) as T | null }
      }),
    )
  }
}

import crypto from "node:crypto"
import joi from "joi"

const REQUEST_ID_HEADER = "x-request-id"
const uuidSchema = joi.string().uuid()

export const requestId = (req, res, next) => {
  const incoming = req.headers[REQUEST_ID_HEADER]
  let id = crypto.randomUUID()

  if (incoming) {
    const { error } = uuidSchema.validate(incoming)
    if (!error) {
      id = incoming
    }
  }

  req.id = id
  res.setHeader(REQUEST_ID_HEADER, id)
  next()
}

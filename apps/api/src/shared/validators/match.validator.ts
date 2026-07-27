import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator"

/** Validate that a property equals a sibling property's value, e.g. a password confirmation. */
export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: "Match",
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          return value === (args.object as Record<string, unknown>)[args.constraints[0]]
        },
      },
    })
  }
}

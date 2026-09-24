// Runs the @nestjs/swagger CLI plugin under ts-jest.
//
// The plugin is a TypeScript AST transformer that reads the TS types off the response classes
// and synthesises the @ApiProperty metadata nobody writes by hand (grep: there is not one
// @ApiProperty in src/). The request DTOs are Zod schemas, which Nest converts on its own, so
// the plugin reads `.response.ts` files only. It is configured in nest-cli.json, which only
// governs `nest build` / `nest start` — ts-jest has its own transform chain and never sees it.
// Without this shim every response schema in a Jest-generated document is
// `{ type: "object", properties: {} }`.
//
// ts-jest's astTransformers contract wants { name, version, factory }; the plugin exports
// `before(options, program)`. Bumping `version` invalidates ts-jest's compilation cache,
// so change it whenever the options below change.
const plugin = require("@nestjs/swagger/plugin")

module.exports.name = "nestjs-swagger-plugin"
module.exports.version = 3

// Keep these in sync with nest-cli.json#compilerOptions.plugins — a divergence would mean
// the document under test is not the document that ships.
module.exports.factory = (compiler) =>
  plugin.before(
    { introspectComments: true, dtoFileNameSuffix: [".response.ts"] },
    compiler.program ?? compiler.languageService?.getProgram(),
  )

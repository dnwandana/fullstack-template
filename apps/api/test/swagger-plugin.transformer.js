// Runs the @nestjs/swagger CLI plugin under ts-jest.
//
// The plugin is a TypeScript AST transformer that reads class-validator decorators and TS
// types off DTO classes and synthesises the @ApiProperty metadata nobody writes by hand
// (grep: there is not one @ApiProperty in src/). It is configured in nest-cli.json, which
// only governs `nest build` / `nest start` — ts-jest has its own transform chain and never
// sees it. Without this shim every DTO schema in a Jest-generated document is
// `{ type: "object", properties: {} }`, so swagger.e2e-spec.ts can assert that a $ref
// exists but not that anything is behind it.
//
// ts-jest's astTransformers contract wants { name, version, factory }; the plugin exports
// `before(options, program)`. Bumping `version` invalidates ts-jest's compilation cache,
// so change it whenever the options below change.
const plugin = require("@nestjs/swagger/plugin")

module.exports.name = "nestjs-swagger-plugin"
module.exports.version = 1

// Keep these in sync with nest-cli.json#compilerOptions.plugins — a divergence would mean
// the document under test is not the document that ships.
module.exports.factory = (compiler) =>
  plugin.before(
    { introspectComments: true, dtoFileNameSuffix: [".dto.ts"] },
    compiler.program ?? compiler.languageService?.getProgram(),
  )

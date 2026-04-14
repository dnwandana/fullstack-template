export default async function teardown() {
  const db = globalThis.__TEST_DB__
  if (db) {
    await db.migrate.rollback(undefined, true)
    await db.destroy()
  }
}

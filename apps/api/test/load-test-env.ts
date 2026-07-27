import { config } from "dotenv"
import { resolve } from "path"

// Runs before anything imports config: `override: true` so .env.test beats a shell-exported or
// already-loaded value, which is what keeps a developer's dev DATABASE_URL out of the test run.
config({ path: resolve(__dirname, "../.env.test"), override: true })

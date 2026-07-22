import { ipKeyGenerator } from "express-rate-limit"
import { request, cleanAllTables, extractCookies } from "../helpers.js"
import { authLimiter, generalLimiter } from "../../src/middlewares/rate-limit.js"

// Supertest drives every request from the same loopback address, so rate-limit
// counters accumulate across the whole file. The auth limiter allows at most 50
// hits per IP per 15-minute window (validate-env caps RATE_LIMIT_AUTH_MAX at
// 50), which this file exceeds in total. Clear the counters between tests so an
// earlier test can never starve a later one with a 429.
const CLIENT_KEY = ipKeyGenerator("::ffff:127.0.0.1")

beforeEach(() => {
  authLimiter.resetKey(CLIENT_KEY)
  generalLimiter.resetKey(CLIENT_KEY)
})

afterEach(async () => {
  await cleanAllTables()
})

describe("POST /api/auth/signup", () => {
  const validPayload = {
    name: "New User",
    email: "newuser@test.com",
    password: "Testpass123!",
    confirmation_password: "Testpass123!",
  }

  it("should create a new user", async () => {
    const res = await (await request()).post("/api/auth/signup").send(validPayload)

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("Created")
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toBe("New User")
    expect(res.body.data.email).toBe("newuser@test.com")
  })

  it("should reject duplicate email", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send(validPayload)

    const res = await agent.post("/api/auth/signup").send({ ...validPayload, name: "Someone Else" })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("email already exists")
  })

  it("should never return 5xx when two identical signups race", async () => {
    const agent = await request()

    const results = await Promise.all([
      agent.post("/api/auth/signup").send(validPayload),
      agent.post("/api/auth/signup").send(validPayload),
    ])

    const statuses = results.map((r) => r.status).toSorted()
    expect(statuses).toEqual([201, 400])
  })

  it("should lowercase the email on signup", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, email: "NewUser@Test.com" })

    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe("newuser@test.com")
  })

  it("should reject a duplicate email differing only in case", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send(validPayload)

    const res = await agent
      .post("/api/auth/signup")
      .send({ ...validPayload, email: "NEWUSER@test.com" })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("email already exists")
  })

  it("should trim surrounding whitespace from the email", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, email: "  spaced@test.com  " })

    expect(res.status).toBe(201)
    expect(res.body.data.email).toBe("spaced@test.com")
  })

  it("should reject missing name", async () => {
    const { name: _name, ...noName } = validPayload
    const res = await (await request()).post("/api/auth/signup").send(noName)
    expect(res.status).toBe(400)
  })

  it("should reject name longer than 100 characters", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, name: "a".repeat(101) })
    expect(res.status).toBe(400)
  })

  it("should reject a name containing a bidi override character", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, name: "Alice\u202Ecod.exe" })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain("control characters")
  })

  it("should reject a name containing a newline", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, name: "Alice\nBob" })

    expect(res.status).toBe(400)
  })

  it("should accept accented Latin, CJK, and ZWNJ-bearing names", async () => {
    const names = ["José Ñuñez", "张伟", "می‌خواهم"]

    for (const [index, name] of names.entries()) {
      const res = await (
        await request()
      )
        .post("/api/auth/signup")
        .send({ ...validPayload, name, email: `intl${index}@test.com` })

      expect(res.status).toBe(201)
      expect(res.body.data.name).toBe(name)
    }
  })

  it("should reject missing email", async () => {
    const { email: _email, ...noEmail } = validPayload
    const res = await (await request()).post("/api/auth/signup").send(noEmail)
    expect(res.status).toBe(400)
  })

  it("should reject invalid email", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, email: "not-an-email" })
    expect(res.status).toBe(400)
  })

  it("should reject password shorter than 8 characters", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, password: "short", confirmation_password: "short" })
    expect(res.status).toBe(400)
  })

  it("should reject password without complexity requirements", async () => {
    const res = await (await request()).post("/api/auth/signup").send({
      ...validPayload,
      password: "simplepassword",
      confirmation_password: "simplepassword",
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/uppercase|digit|special/i)
  })

  it("should reject mismatched confirmation_password", async () => {
    const res = await (
      await request()
    )
      .post("/api/auth/signup")
      .send({ ...validPayload, confirmation_password: "Differentpass1!" })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain("confirmation_password")
  })
})

describe("POST /api/auth/signin", () => {
  it("should sign in with valid credentials", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Login User",
      email: "loginuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signin").send({
      email: "loginuser@test.com",
      password: "Testpass123!",
    })

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toBe("Login User")
    expect(res.body.data.email).toBe("loginuser@test.com")
    expect(res.headers["set-cookie"]).toBeDefined()
    const cookieHeader = res.headers["set-cookie"]
    const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader
    expect(cookieStr).toContain("access_token=")
    expect(cookieStr).toContain("refresh_token=")
    expect(cookieStr).toContain("HttpOnly")
    expect(res.body.data.access_token).toBeUndefined()
    expect(res.body.data.refresh_token).toBeUndefined()
  })

  it("should sign in when the email case differs from signup", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Case User",
      email: "caseuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signin").send({
      email: "CaseUser@Test.com",
      password: "Testpass123!",
    })

    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe("caseuser@test.com")
  })

  it("should reject invalid password", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Login User Two",
      email: "loginuser2@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    const res = await agent.post("/api/auth/signin").send({
      email: "loginuser2@test.com",
      password: "Wrongpass1!",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should reject non-existent email", async () => {
    const res = await (await request()).post("/api/auth/signin").send({
      email: "nonexistent@test.com",
      password: "Testpass123!",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should lock account after 5 failed attempts", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Lock User",
      email: "lockuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await agent.post("/api/auth/signin").send({
        email: "lockuser@test.com",
        password: "Wrongpass1!",
      })
    }

    // 6th attempt with correct password should be locked
    const res = await agent.post("/api/auth/signin").send({
      email: "lockuser@test.com",
      password: "Testpass123!",
    })

    expect(res.status).toBe(401)
    expect(res.body.message).toContain("invalid credentials")
  })

  it("should reset failed attempts on successful login", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Reset User",
      email: "resetuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })

    // 3 failed attempts (below lockout threshold)
    for (let i = 0; i < 3; i++) {
      await agent.post("/api/auth/signin").send({
        email: "resetuser@test.com",
        password: "Wrongpass1!",
      })
    }

    // Successful login should reset counter
    const res = await agent.post("/api/auth/signin").send({
      email: "resetuser@test.com",
      password: "Testpass123!",
    })

    expect(res.status).toBe(200)

    // Should be able to fail 5 more times before lockout (proves counter was reset)
    for (let i = 0; i < 4; i++) {
      await agent.post("/api/auth/signin").send({
        email: "resetuser@test.com",
        password: "Wrongpass1!",
      })
    }
    const stillOk = await agent.post("/api/auth/signin").send({
      email: "resetuser@test.com",
      password: "Testpass123!",
    })
    expect(stillOk.status).toBe(200)
  })
})

describe("POST /api/auth/refresh", () => {
  it("should return new cookies on refresh (rotation)", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Refresh User",
      email: "refreshuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      email: "refreshuser@test.com",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    const res = await agent.post("/api/auth/refresh").set("Cookie", cookieStr)

    expect(res.status).toBe(200)
    expect(res.headers["set-cookie"]).toBeDefined()
    const newCookieStr = Array.isArray(res.headers["set-cookie"])
      ? res.headers["set-cookie"].join("; ")
      : res.headers["set-cookie"]
    expect(newCookieStr).toContain("access_token=")
    expect(newCookieStr).toContain("refresh_token=")
  })

  it("should reject reused refresh token (rotation)", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Reuse User",
      email: "reuseuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      email: "reuseuser@test.com",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    await agent.post("/api/auth/refresh").set("Cookie", cookieStr)

    const res = await agent.post("/api/auth/refresh").set("Cookie", cookieStr)

    expect(res.status).toBe(401)
  })

  it("should reject request without refresh token", async () => {
    const res = await (await request()).post("/api/auth/refresh")

    expect(res.status).toBe(401)
  })
})

describe("POST /api/auth/logout", () => {
  it("should revoke refresh token on logout", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Logout User",
      email: "logoutuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      email: "logoutuser@test.com",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    const logoutRes = await agent.post("/api/auth/logout").set("Cookie", cookieStr)
    expect(logoutRes.status).toBe(200)

    const refreshRes = await agent.post("/api/auth/refresh").set("Cookie", cookieStr)
    expect(refreshRes.status).toBe(401)
  })

  it("should return 401 without refresh token cookie", async () => {
    const agent = await request()
    const res = await agent.post("/api/auth/logout")

    expect(res.status).toBe(401)
  })
})

describe("GET /api/auth/me", () => {
  it("should return current user with valid access token", async () => {
    const agent = await request()
    await agent.post("/api/auth/signup").send({
      name: "Me User",
      email: "meuser@test.com",
      password: "Testpass123!",
      confirmation_password: "Testpass123!",
    })
    const signinRes = await agent.post("/api/auth/signin").send({
      email: "meuser@test.com",
      password: "Testpass123!",
    })

    const cookieStr = extractCookies(signinRes)

    const res = await agent.get("/api/auth/me").set("Cookie", cookieStr)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.name).toBe("Me User")
    expect(res.body.data.email).toBe("meuser@test.com")
  })

  it("should return 401 without access token", async () => {
    const res = await (await request()).get("/api/auth/me")

    expect(res.status).toBe(401)
  })

  it("should return 401 with invalid access token", async () => {
    const agent = await request()

    const res = await agent.get("/api/auth/me").set("Cookie", "access_token=invalidtoken")

    expect(res.status).toBe(401)
  })
})

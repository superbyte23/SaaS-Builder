import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, organizationsTable, branchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken, createSession, deleteSession, getSession } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password, organizationName, businessType } = req.body;
  if (!name || !email || !password || !organizationName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const [org] = await db.insert(organizationsTable).values({
    name: organizationName,
    businessType: businessType || "retail",
    plan: "trial",
    status: "trial",
  }).returning();

  const [branch] = await db.insert(branchesTable).values({
    organizationId: org.id,
    name: "Main Branch",
    isMain: true,
    status: "active",
  }).returning();

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    organizationId: org.id,
    branchId: branch.id,
    name,
    email,
    passwordHash,
    role: "owner",
    status: "active",
  }).returning();

  const token = generateToken();
  createSession(token, user.id, org.id);

  res.status(201).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      branchId: user.branchId,
      organizationName: org.name,
      avatar: user.avatar,
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.status === "inactive") {
    res.status(403).json({ error: "Account is inactive" });
    return;
  }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.organizationId));

  const token = generateToken();
  createSession(token, user.id, user.organizationId);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      branchId: user.branchId,
      organizationName: org?.name ?? "",
      avatar: user.avatar,
    },
    token,
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    deleteSession(authHeader.slice(7));
  }
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.organizationId));

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId,
    organizationName: org?.name ?? "",
    avatar: user.avatar,
  });
});

export default router;

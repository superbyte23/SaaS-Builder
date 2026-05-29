import crypto from "crypto";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
  return attempt === hash;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const sessions = new Map<string, { userId: number; organizationId: number; expiresAt: number }>();

export function createSession(token: string, userId: number, organizationId: number): void {
  sessions.set(token, {
    userId,
    organizationId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
}

export function getSession(token: string): { userId: number; organizationId: number } | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return { userId: session.userId, organizationId: session.organizationId };
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

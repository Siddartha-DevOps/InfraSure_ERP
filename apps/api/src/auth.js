// JWT issuing/verification + password hashing for InfraSure ERP.
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Token carries the claims every resolver relies on: user_id, tenant_id, role.
export function signToken({ user_id, tenant_id, role }) {
  return jwt.sign({ user_id, tenant_id, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Decode the Authorization header into a user context, or null if absent/invalid.
export function getUserFromAuthHeader(header) {
  if (!header) return null;
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  try {
    const { user_id, tenant_id, role } = jwt.verify(token, JWT_SECRET);
    return { user_id, tenant_id, role };
  } catch {
    return null;
  }
}

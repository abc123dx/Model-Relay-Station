import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "relay_admin";

type SessionPayload = {
  role: "admin";
  exp: number;
};

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function requiredSecret(name: "ADMIN_PASSWORD" | "ADMIN_SESSION_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Copy .env.example to .env.local and set a strong value.`
    );
  }
  return value;
}

function secret() {
  return requiredSecret("ADMIN_SESSION_SECRET");
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function verifyAdminPassword(password: string) {
  const configured = requiredSecret("ADMIN_PASSWORD");
  const left = Buffer.from(password);
  const right = Buffer.from(configured);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createAdminSession() {
  const payload: SessionPayload = {
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyAdminSession(token?: string | null) {
  if (!token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.role === "admin" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminSession(token)) {
    redirect("/admin/login");
  }
}

export function isAdminRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;
  const token = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${ADMIN_COOKIE_NAME}=`))
    ?.slice(ADMIN_COOKIE_NAME.length + 1);
  return verifyAdminSession(token ? decodeURIComponent(token) : null);
}

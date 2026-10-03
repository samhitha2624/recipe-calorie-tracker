import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type RequestHandler, type Response } from "express";
import type { PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "./http.js";

const COOKIE = "sid";
const SESSION_DAYS = 30;

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name });

export function loadUser(prisma: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    const sid = req.cookies?.[COOKIE];
    if (typeof sid === "string") {
      const session = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
      if (session && session.expiresAt > new Date()) req.user = session.user;
    }
    next();
  };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, "Please log in");
  next();
};

const signupBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(60),
  password: z.string().min(8, "must be at least 8 characters").max(200),
});
const loginBody = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

export function authRoutes(prisma: PrismaClient) {
  const r = Router();

  async function startSession(res: Response, userId: number) {
    const id = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await prisma.session.create({ data: { id, userId, expiresAt } });
    res.cookie(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
    });
  }

  r.post("/signup", async (req, res) => {
    const body = signupBody.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) {
      throw new HttpError(409, "An account with that email already exists");
    }
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, passwordHash: await bcrypt.hash(body.password, 10) },
    });
    await startSession(res, user.id);
    res.status(201).json(publicUser(user));
  });

  r.post("/login", async (req, res) => {
    const body = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, "Wrong email or password");
    }
    await startSession(res, user.id);
    res.json(publicUser(user));
  });

  r.post("/logout", async (req, res) => {
    const sid = req.cookies?.[COOKIE];
    if (typeof sid === "string") await prisma.session.deleteMany({ where: { id: sid } });
    res.clearCookie(COOKIE);
    res.status(204).end();
  });

  r.get("/me", (req, res) => {
    if (!req.user) throw new HttpError(401, "Please log in");
    res.json(publicUser(req.user));
  });

  return r;
}

import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = (body.email as string)?.toLowerCase()?.trim();
  const password = body.password as string;
  const name = (body.name as string)?.trim() || "User";

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (min 8 chars) required" },
      { status: 400 }
    );
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const base = slugify(body.username || name || email.split("@")[0]) || "user";
  let username = base;
  let i = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}-${i++}`;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      username,
      passwordHash: await hash(password, 10),
    },
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, username: user.username },
  });
}

"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Calendar } from "lucide-react";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(demo ? "demo@opencal.dev" : "");
  const [password, setPassword] = useState(demo ? "demo1234" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/calendar");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-10 text-white md:flex">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Calendar className="h-4 w-4" />
          </div>
          OpenCal
        </Link>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">
            Sync calendars.
            <br />
            Share booking links.
            <br />
            One unified view.
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Multi-way calendar sync, privacy controls, scheduling links, and
            MCP for AI assistants — open source and self-hostable.
          </p>
        </div>
        <p className="text-xs text-slate-500">MIT Licensed · Self-hostable</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            {demo && (
              <p className="mt-1 text-sm text-muted">
                Demo: demo@opencal.dev / demo1234
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted">
            No account?{" "}
            <Link href="/register" className="font-medium text-primary">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

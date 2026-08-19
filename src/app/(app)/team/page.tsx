"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { format } from "date-fns";
import { Plus, Users } from "lucide-react";

type Team = {
  id: string;
  name: string;
  members: {
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      username: string;
    };
  }[];
};

export default function TeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState<
    { userId: string; startAt: string; endAt: string; title: string }[]
  >([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  async function load() {
    const res = await fetch("/api/team");
    const data = await res.json();
    setTeams(data.teams || []);
    setBusy(data.teammateBusy || []);
    if (data.teams?.[0] && !selectedTeam) {
      setSelectedTeam(data.teams[0].id);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: teamName || "My Team" }),
    });
    setTeamName("");
    load();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeam) return;
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        teamId: selectedTeam,
        email: inviteEmail,
      }),
    });
    setInviteEmail("");
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Invite teammates for collective scheduling links and anonymized
          availability (shown as “Busy”).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" /> Create team
          </h2>
          <form onSubmit={createTeam} className="flex gap-2">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <Button type="submit">Create</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Invite member</h2>
          <form onSubmit={invite} className="space-y-2">
            <SelectTeam
              teams={teams}
              value={selectedTeam}
              onChange={setSelectedTeam}
            />
            <div className="flex gap-2">
              <Input
                placeholder="email or username"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button type="submit">Invite</Button>
            </div>
            <p className="text-xs text-muted">
              Demo: try inviting <code>alex@opencal.dev</code>
            </p>
          </form>
        </Card>
      </div>

      {teams.map((t) => (
        <Card key={t.id} className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-primary" />
            {t.name}
          </h2>
          <div className="mt-4 space-y-2">
            {t.members.map((m) => (
              <div
                key={m.user.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {m.user.name || m.user.username}
                  </div>
                  <div className="text-xs text-muted">
                    {m.user.email} · @{m.user.username}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="p-5">
        <h2 className="font-semibold">Teammate availability (anonymized)</h2>
        <p className="mt-1 text-sm text-muted">
          Only busy blocks — never titles or details from teammates’ calendars.
        </p>
        <div className="mt-4 space-y-2">
          {busy.slice(0, 20).map((b, i) => (
            <div
              key={i}
              className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-600">Busy</span>
              <span className="text-muted">
                {format(new Date(b.startAt), "PPp")} –{" "}
                {format(new Date(b.endAt), "p")}
              </span>
            </div>
          ))}
          {busy.length === 0 && (
            <p className="text-sm text-muted">No teammate busy times loaded.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function SelectTeam({
  teams,
  value,
  onChange,
}: {
  teams: Team[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>Team</Label>
      <select
        className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

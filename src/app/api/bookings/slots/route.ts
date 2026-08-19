import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatSlotLabel, getSlotsForLink } from "@/lib/scheduling/availability";
import { parseJson } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const slug = searchParams.get("slug");
  const duration = Number(searchParams.get("duration") || 30);
  const from = searchParams.get("from");

  if (!username || !slug) {
    return NextResponse.json({ error: "username and slug required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await prisma.schedulingLink.findFirst({
    where: { userId: user.id, slug, enabled: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const durations = parseJson<number[]>(link.durations, [30]);
  const dur = durations.includes(duration) ? duration : durations[0];

  const { slots } = await getSlotsForLink(
    link.id,
    dur,
    from ? new Date(from) : undefined
  );

  return NextResponse.json({
    slots: slots.map((s) => formatSlotLabel(s)),
    durations,
    duration: dur,
    link: {
      title: link.title,
      description: link.description,
      locationType: link.locationType,
      brandColor: link.brandColor || user.brandColor,
      coverImage: link.coverImage || user.brandCover,
      language: link.language,
      allowGuests: link.allowGuests,
      requireApproval: link.requireApproval,
      questions: parseJson(link.questionsJson, []),
      host: {
        name: user.name,
        username: user.username,
        bio: user.bio,
        image: user.image,
        socialLinks: parseJson(user.socialLinks, {}),
      },
    },
  });
}

import type { APIRoute } from "astro";
import { invalidateTags } from "@/lib/with-cache";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { tags?: string[] };
    const tags = body.tags;

    if (!Array.isArray(tags) || tags.length === 0) {
      return Response.json({ message: "Missing Tags" }, { status: 400 });
    }

    return Response.json({
      purgedTags: tags,
      purgedEntries: invalidateTags(tags),
    });
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }
};

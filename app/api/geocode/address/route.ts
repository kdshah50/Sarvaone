import { NextRequest, NextResponse } from "next/server";
import { geocodeUsAddress } from "@/lib/geocode-us-address";

export const dynamic = "force-dynamic";

/** GET ?q= — approximate geocode for static ride maps (server-side Nominatim proxy). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 4) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const hit = await geocodeUsAddress(q);
  if (!hit) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  return NextResponse.json(hit);
}

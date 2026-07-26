import { NextRequest, NextResponse } from "next/server";
import { MI_TO_KM } from "@rr/shared";
import { requireUser } from "../../../lib/auth";

/**
 * Server-side driving-distance lookup for mobile's "Automatic" mileage
 * entry. GOOGLE_MAPS_API_KEY never reaches a client bundle — same rule as
 * OPENAI_API_KEY — so mobile posts the two addresses here instead of
 * calling Google directly.
 */
export const runtime = "nodejs";

interface DistanceMatrixResponse {
  status: string;
  rows: {
    elements: {
      status: string;
      distance?: { value: number }; // meters, regardless of the `units` param
    }[];
  }[];
  origin_addresses: string[];
  destination_addresses: string[];
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const startAddress = body?.startAddress?.trim();
  const endAddress = body?.endAddress?.trim();
  const unit = body?.unit === "km" ? "km" : "mi";
  if (!startAddress || !endAddress) {
    return NextResponse.json({ error: "Both a start and end address are required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Automatic distance calculation isn't configured yet" }, { status: 503 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", startAddress);
  url.searchParams.set("destinations", endAddress);
  url.searchParams.set("key", apiKey);

  let json: DistanceMatrixResponse;
  try {
    const res = await fetch(url);
    json = await res.json();
  } catch {
    return NextResponse.json({ error: "Could not reach the mapping service" }, { status: 502 });
  }

  if (json.status !== "OK") {
    return NextResponse.json({ error: `Mapping service error: ${json.status}` }, { status: 502 });
  }

  const element = json.rows[0]?.elements[0];
  if (!element || element.status !== "OK" || element.distance === undefined) {
    // NOT_FOUND / ZERO_RESULTS: one or both addresses couldn't be resolved
    // or no route exists between them. Never fabricate a distance here —
    // the client falls back to manual entry.
    return NextResponse.json(
      { error: "Couldn't find a route between those addresses — check them, or enter the distance manually." },
      { status: 422 },
    );
  }

  const meters = element.distance.value;
  const distance = unit === "km" ? meters / 1000 : meters / 1000 / MI_TO_KM;

  return NextResponse.json({
    distance,
    unit,
    originAddress: json.origin_addresses[0] ?? startAddress,
    destinationAddress: json.destination_addresses[0] ?? endAddress,
  });
}

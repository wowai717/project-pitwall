import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key') ?? '';
  const year = request.nextUrl.searchParams.get('year') ?? '';
  if (!/^\d{1,4}$/.test(key) || Number(key) < 1 || !/^202[0-5]$/.test(year))
    return NextResponse.json({ error: 'Invalid circuit' }, { status: 400 });
  try {
    const response = await fetch(
      `https://api.multiviewer.app/api/v1/circuits/${key}/${year}`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: 'Circuit metadata unavailable' },
        { status: 404 },
      );
    const data = await response.json();
    if (!Array.isArray(data.corners))
      return NextResponse.json(
        { error: 'Circuit metadata unavailable' },
        { status: 404 },
      );
    return NextResponse.json({
      year: data.year,
      rotation: data.rotation,
      corners: data.corners,
    });
  } catch {
    return NextResponse.json(
      { error: 'Circuit metadata unavailable' },
      { status: 503 },
    );
  }
}

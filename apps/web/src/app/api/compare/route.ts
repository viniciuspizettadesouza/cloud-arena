const DEFAULT_API_URL = "http://localhost:3001";

export async function POST(request: Request) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL}/v1/compare`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await request.text(),
        cache: "no-store",
      },
    );
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "API_UNAVAILABLE",
          message: "The comparison API is unavailable. Start the API and try again.",
        },
      },
      { status: 502 },
    );
  }
}

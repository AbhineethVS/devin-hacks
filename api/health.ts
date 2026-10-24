// Vercel function using the Web standard signature: GET /api/health → { ok: true }.
export function GET(): Response {
  return Response.json({ ok: true });
}

/* The Ask box, server-side. The Anthropic API key lives only here,
   in an environment variable — it never ships to the browser. */

export async function POST(req) {
  const { question, payload } = await req.json();
  if (!question) return Response.json({ text: "Ask me something first." });

  const prompt =
    `You are the quiet assistant inside "Rhythm," a personal household ` +
    `schedule app. Answer the question using only the data below. Be brief, ` +
    `concrete, warm. Plain prose, no markdown headers or bullets unless ` +
    `truly needed.\n\nDATA:\n${JSON.stringify(payload)}\n\nQUESTION: ${question}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    return Response.json(
      { text: "The assistant couldn't answer right now — try again in a moment." },
      { status: 200 }
    );
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return Response.json({ text });
}

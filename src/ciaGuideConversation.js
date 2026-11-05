const encoder = new TextEncoder();
const serializedBytes = value => encoder.encode(JSON.stringify(value)).byteLength;

export function getCiaConversationHistory(messages) {
  const candidates = (Array.isArray(messages) ? messages : [])
    .filter(item => ["visitor", "cia"].includes(item?.role) && typeof item.body === "string")
    .slice(-4)
    .map(({ role, body }) => ({
      role,
      body: body.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, "").trim().slice(0, 600),
    })).filter(item => item.body);
  const history = [];
  // Preserve the newest context first. The full request still needs space for
  // 900 CJK characters and JSON metadata beneath the Worker's 8 KiB ceiling.
  for (const turn of candidates.reverse()) {
    let body = turn.body;
    while (body && serializedBytes([{ role: turn.role, body }, ...history]) > 4200) body = body.slice(0, -1);
    if (!body.trim()) break;
    history.unshift({ role: turn.role, body: body.trim() });
  }
  return history;
}

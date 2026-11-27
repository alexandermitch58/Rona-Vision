// Client REST fal.ai Queue — tanpa SDK, supaya jalan di Pages Functions.
// Docs: https://fal.ai/models/bytedance/seedance-2.5/text-to-video/api
// Pola: submit -> request_id -> poll status -> ambil result.

export async function falSubmit(env, falModel, input, webhookUrl) {
  const res = await fetch(`https://queue.fal.run/${falModel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `fal submit gagal: HTTP ${res.status}`);
  }
  // { request_id, status_url, response_url, cancel_url }
  return data;
}

export async function falStatus(env, falModel, requestId) {
  const res = await fetch(
    `https://queue.fal.run/${falModel}/requests/${requestId}/status`,
    { headers: { Authorization: `Key ${env.FAL_KEY}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `fal status gagal: HTTP ${res.status}`);
  }
  return data; // { status: IN_QUEUE | IN_PROGRESS | COMPLETED, ... }
}

export async function falResult(env, falModel, requestId) {
  const res = await fetch(
    `https://queue.fal.run/${falModel}/requests/${requestId}`,
    { headers: { Authorization: `Key ${env.FAL_KEY}` } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `fal result gagal: HTTP ${res.status}`);
  }
  return data; // { data: { video: { url } }, ... }
}

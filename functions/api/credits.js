// GET /api/credits — cek sisa kredit.
// TODO auth: ganti userId dengan id dari session setelah login dibangun.

import { getCredits } from "../_lib/store.js";

export async function onRequestGet(context) {
  try {
    const balance = await getCredits(context.env, "admin");
    return Response.json({ user_id: "admin", credits: balance });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

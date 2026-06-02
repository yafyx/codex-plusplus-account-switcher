function emailFromAuthString(raw) {
  try {
    return emailFromAuth(JSON.parse(raw));
  } catch {
    return null;
  }
}

function emailFromAuth(auth) {
  const direct = auth?.email || auth?.user?.email || auth?.account?.email;
  if (typeof direct === "string" && direct.includes("@")) return direct;

  const claims = claimsFromToken(auth?.tokens?.id_token);
  return typeof claims?.email === "string" && claims.email.includes("@") ? claims.email : null;
}

function planFromAuthString(raw) {
  try {
    return planFromAuth(JSON.parse(raw));
  } catch {
    return null;
  }
}

function planFromAuth(auth) {
  for (const token of [auth?.tokens?.id_token, auth?.tokens?.access_token]) {
    const plan = claimsFromToken(token)?.["https://api.openai.com/auth"]?.chatgpt_plan_type;
    if (typeof plan === "string" && plan.trim()) return plan.trim().toLowerCase();
  }
  return null;
}

function claimsFromToken(token) {
  if (typeof token !== "string") return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

module.exports = { emailFromAuthString, emailFromAuth, planFromAuthString, planFromAuth };

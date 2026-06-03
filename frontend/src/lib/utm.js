// Captures UTM parameters from URL on load and persists in localStorage for 30 days.
const KEY = "ozx_utm";
const LEADER_KEY = "ozx_leader_slug";

export function captureUTM() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  if (Object.keys(utm).length > 0) {
    utm.referrer = document.referrer || "";
    utm.captured_at = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(utm));
  }
  // Capture leader slug from URL pattern /l/{slug}
  const pathMatch = window.location.pathname.match(/^\/l\/([a-z0-9-]+)/i);
  if (pathMatch) {
    localStorage.setItem(LEADER_KEY, pathMatch[1]);
  }
  const leaderParam = params.get("ref") || params.get("leader");
  if (leaderParam) {
    localStorage.setItem(LEADER_KEY, leaderParam);
  }
}

export function getUTM() {
  try {
    const raw = localStorage.getItem(KEY);
    const utm = raw ? JSON.parse(raw) : {};
    const leader = localStorage.getItem(LEADER_KEY);
    if (leader) utm.leader_slug = leader;
    return utm;
  } catch {
    return {};
  }
}

export function getOrCreateSessionId() {
  let id = sessionStorage.getItem("ozx_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("ozx_sid", id);
  }
  return id;
}

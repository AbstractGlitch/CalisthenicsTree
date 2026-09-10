/** Small shared view helpers. */

export const esc = (s: string): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** magnetic-practice's toast, sitting above the bottom nav. */
export function toast(msg: string): void {
  let el = document.querySelector<HTMLDivElement>("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    el.style.cssText =
      "position:fixed;bottom:calc(84px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);" +
      "background:var(--card2);border:1px solid var(--line);color:var(--txt);padding:10px 16px;" +
      "border-radius:12px;font-size:13px;z-index:50;box-shadow:0 8px 30px rgba(0,0,0,.5);" +
      "opacity:0;transition:.2s;max-width:80%;text-align:center;pointer-events:none;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (el) el.style.opacity = "0"; }, 1600);
}

export const ACTION_LABEL: Record<string, string> = {
  locked: "Locked",
  ready_to_start: "Ready to start",
  in_progress: "In progress",
  needs_consolidation: "Needs consolidating",
  consolidated: "Consolidated",
  needs_refresh: "Needs a refresh",
};

/** "3 days ago" / "today". */
export function relativeDay(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

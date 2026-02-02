const KEY = "ddash.v1";

const now = () => Date.now();

/**
 * Darren Life Dashboard defaults (no UI changes)
 *
 * Domains / Threads are life-first:
 * - Health & Energy
 * - Business (Occono Auto / Solar / etc)
 * - Home & Family
 * - Money & Admin
 * - Media Machine / Homelab
 * - Personal AI (OpenClaw)
 *
 * Stage 2 schema:
 * - nextActions + threads include createdAt/updatedAt
 * - ui persists search + actionsFilter
 * - integrations reserved for future OpenClaw access (disabled by default)
 */

const DEFAULTS = {
  user: { name: "Darren", email: "you@example.com" },

  // Keep the same KPI card labels (UI unchanged), but make the meaning life-first.
  kpis: {
    activeThreads: 6, // number of active life domains you're touching this week
    openLoops: 12, // open loops across life/admin
    waitingOn: 3, // blocked by others
    momentum: 4, // wins this week
  },

  focusNow: {
    title: "Focus Session",
    subtitle: "Pick ONE thing. Close ONE loop.",
    current: "Clear the highest-friction open loop",
  },

  // Today’s executables — life-first.
  nextActions: [
    { id: "a1", text: "20 min walk (no phone)", done: false, createdAt: now(), updatedAt: now() },
    { id: "a2", text: "Handle 1 money/admin task (pay, file, book, cancel)", done: false, createdAt: now(), updatedAt: now() },
    { id: "a3", text: "Move 1 business thread forward (one concrete step)", done: false, createdAt: now(), updatedAt: now() },
    { id: "a4", text: "Home: do the smallest next physical action", done: false, createdAt: now(), updatedAt: now() },
  ],

  reminders: [
    {
      id: "r1",
      title: "Next commitment",
      when: "Today 2:00–4:00pm",
      cta: "Start",
    },
  ],

  // Life domains as “threads”
  threads: [
    {
      id: "t_health",
      title: "Health & Energy",
      note: "Sleep, movement, food, stress. Keep the basics strong.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "t_business",
      title: "Business",
      note: "Revenue, delivery, ops. One move at a time.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "t_home",
      title: "Home & Family",
      note: "Household, relationships, life logistics.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "t_money",
      title: "Money & Admin",
      note: "Bills, paperwork, scheduling, accounts.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "t_media",
      title: "Media Machine / Homelab",
      note: "Ripping, Jellyfin, Pi stability, backups.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: "t_ai",
      title: "Personal AI (OpenClaw)",
      note: "Deploy + integrate safely. Guardrails first.",
      createdAt: now(),
      updatedAt: now(),
    },
  ],

  scratchpad: { text: "" },

  timer: { running: false, seconds: 0 },

  // UI state we persist (so filters/sort/search survive refresh)
  ui: {
    search: "",
    actionsFilter: "open", // "open" | "done" | "all"
  },

  /**
   * Reserved integrations (future)
   * We will allow OpenClaw access here when ready.
   * Keep disabled by default. No secrets stored here.
   */
  integrations: {
    openclaw: {
      enabled: false,
      mode: "off", // off | local | remote
      endpoint: "", // e.g. http://pi:PORT (later)
      notes: "Reserved for future OpenClaw dashboard access.",
      lastSeenAt: null,
    },
  },
};

function structuredCloneSafe(obj) {
  try {
    // eslint-disable-next-line no-undef
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeState(s) {
  const base = structuredCloneSafe(DEFAULTS);
  const merged = { ...base, ...(s && typeof s === "object" ? s : {}) };

  // Normalize arrays
  if (!Array.isArray(merged.nextActions)) merged.nextActions = base.nextActions;
  if (!Array.isArray(merged.threads)) merged.threads = base.threads;
  if (!Array.isArray(merged.reminders)) merged.reminders = base.reminders;

  const tNow = now();

  merged.nextActions = merged.nextActions
    .filter((a) => a && typeof a === "object")
    .map((a) => {
      const createdAt = typeof a.createdAt === "number" ? a.createdAt : tNow;
      const updatedAt = typeof a.updatedAt === "number" ? a.updatedAt : createdAt;
      return {
        id: typeof a.id === "string" ? a.id : crypto.randomUUID(),
        text: typeof a.text === "string" ? a.text : "",
        done: !!a.done,
        createdAt,
        updatedAt,
      };
    });

  merged.threads = merged.threads
    .filter((t) => t && typeof t === "object")
    .map((t) => {
      const createdAt = typeof t.createdAt === "number" ? t.createdAt : tNow;
      const updatedAt = typeof t.updatedAt === "number" ? t.updatedAt : createdAt;
      return {
        id: typeof t.id === "string" ? t.id : crypto.randomUUID(),
        title: typeof t.title === "string" ? t.title : "Untitled",
        note: typeof t.note === "string" ? t.note : "",
        createdAt,
        updatedAt,
      };
    });

  // Normalize ui
  if (!merged.ui || typeof merged.ui !== "object") merged.ui = structuredCloneSafe(base.ui);
  merged.ui.search = typeof merged.ui.search === "string" ? merged.ui.search : "";
  merged.ui.actionsFilter = ["open", "done", "all"].includes(merged.ui.actionsFilter)
    ? merged.ui.actionsFilter
    : "open";

  // Normalize integrations (safe defaults; never require these)
  if (!merged.integrations || typeof merged.integrations !== "object") {
    merged.integrations = structuredCloneSafe(base.integrations);
  }
  if (!merged.integrations.openclaw || typeof merged.integrations.openclaw !== "object") {
    merged.integrations.openclaw = structuredCloneSafe(base.integrations.openclaw);
  }
  merged.integrations.openclaw.enabled = !!merged.integrations.openclaw.enabled;
  merged.integrations.openclaw.mode = ["off", "local", "remote"].includes(merged.integrations.openclaw.mode)
    ? merged.integrations.openclaw.mode
    : "off";
  merged.integrations.openclaw.endpoint =
    typeof merged.integrations.openclaw.endpoint === "string" ? merged.integrations.openclaw.endpoint : "";
  merged.integrations.openclaw.notes =
    typeof merged.integrations.openclaw.notes === "string" ? merged.integrations.openclaw.notes : "";
  merged.integrations.openclaw.lastSeenAt =
    typeof merged.integrations.openclaw.lastSeenAt === "number" ? merged.integrations.openclaw.lastSeenAt : null;

  return merged;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return normalizeState(null);
    const parsed = safeParse(raw);
    return normalizeState(parsed);
  } catch {
    return normalizeState(null);
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// Helper for Export/Import or debugging
export function storageKey() {
  return KEY;
}

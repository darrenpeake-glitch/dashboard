const KEY = "ddash.v1";

const now = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  user: { name: "Darren", email: "you@example.com" },

  // These get computed in App, but we keep defaults for safety
  kpis: {
    activeThreads: 6,
    openLoops: 12,
    waitingOn: 3,
    momentum: 4,
  },

  focusNow: {
    title: "Focus Session",
    subtitle: "Pick ONE thing. Close ONE loop.",
    current: "Clear the highest-friction open loop",
  },

  // Life-first actions (now with domain + completedAt)
  nextActions: [
    {
      id: "a1",
      text: "20 min walk (no phone)",
      done: false,
      domain: "Health & Energy",
      createdAt: now(),
      updatedAt: now(),
      completedAt: null,
    },
    {
      id: "a2",
      text: "Handle 1 money/admin task (pay, file, book, cancel)",
      done: false,
      domain: "Money & Admin",
      createdAt: now(),
      updatedAt: now(),
      completedAt: null,
    },
    {
      id: "a3",
      text: "Move 1 business thread forward (one concrete step)",
      done: false,
      domain: "Business",
      createdAt: now(),
      updatedAt: now(),
      completedAt: null,
    },
    {
      id: "a4",
      text: "Home: do the smallest next physical action",
      done: false,
      domain: "Home & Family",
      createdAt: now(),
      updatedAt: now(),
      completedAt: null,
    },
  ],

  // Reminders are now functional (status + startedAt)
  reminders: [
    {
      id: "r1",
      title: "Next commitment",
      when: "Today 2:00–4:00pm",
      cta: "Start",
      status: "pending", // pending | in_progress | done
      createdAt: now(),
      updatedAt: now(),
      startedAt: null,
    },
  ],

  // Life domains as threads
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

  ui: {
    search: "",
    actionsFilter: "open", // open | done | all
    activeView: "dashboard", // dashboard | tasks | calendar | analytics | team
  },

  integrations: {
    openclaw: {
      enabled: false,
      mode: "off", // off | local | remote
      endpoint: "",
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

function clampString(s, fallback = "") {
  return typeof s === "string" ? s : fallback;
}

function clampNumber(n, fallback = null) {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function normalizeAction(a, tNow) {
  const createdAt = clampNumber(a.createdAt, tNow) ?? tNow;
  const updatedAt = clampNumber(a.updatedAt, createdAt) ?? createdAt;
  const done = !!a.done;
  const completedAt = done ? (clampNumber(a.completedAt, updatedAt) ?? updatedAt) : null;

  return {
    id: clampString(a.id, "") || crypto.randomUUID(),
    text: clampString(a.text, ""),
    done,
    domain: clampString(a.domain, ""),
    createdAt,
    updatedAt,
    completedAt,
  };
}

function normalizeThread(t, tNow) {
  const createdAt = clampNumber(t.createdAt, tNow) ?? tNow;
  const updatedAt = clampNumber(t.updatedAt, createdAt) ?? createdAt;

  return {
    id: clampString(t.id, "") || crypto.randomUUID(),
    title: clampString(t.title, "Untitled"),
    note: clampString(t.note, ""),
    createdAt,
    updatedAt,
  };
}

function normalizeReminder(r, tNow) {
  const createdAt = clampNumber(r.createdAt, tNow) ?? tNow;
  const updatedAt = clampNumber(r.updatedAt, createdAt) ?? createdAt;

  const status = ["pending", "in_progress", "done"].includes(r.status) ? r.status : "pending";
  const startedAt = clampNumber(r.startedAt, null);

  return {
    id: clampString(r.id, "") || crypto.randomUUID(),
    title: clampString(r.title, "Reminder"),
    when: clampString(r.when, ""),
    cta: clampString(r.cta, "Start"),
    status,
    createdAt,
    updatedAt,
    startedAt,
  };
}

function normalizeIntegrations(integrations) {
  const base = structuredCloneSafe(DEFAULTS.integrations);

  if (!integrations || typeof integrations !== "object") return base;

  const out = { ...base, ...integrations };

  if (!out.openclaw || typeof out.openclaw !== "object") out.openclaw = structuredCloneSafe(base.openclaw);

  out.openclaw.enabled = !!out.openclaw.enabled;
  out.openclaw.mode = ["off", "local", "remote"].includes(out.openclaw.mode) ? out.openclaw.mode : "off";
  out.openclaw.endpoint = clampString(out.openclaw.endpoint, "");
  out.openclaw.notes = clampString(out.openclaw.notes, "");
  out.openclaw.lastSeenAt = clampNumber(out.openclaw.lastSeenAt, null);

  return out;
}

function normalizeUi(ui) {
  const base = structuredCloneSafe(DEFAULTS.ui);

  if (!ui || typeof ui !== "object") return base;

  const out = { ...base, ...ui };

  out.search = clampString(out.search, "");
  out.actionsFilter = ["open", "done", "all"].includes(out.actionsFilter) ? out.actionsFilter : "open";
  out.activeView = ["dashboard", "tasks", "calendar", "analytics", "team"].includes(out.activeView)
    ? out.activeView
    : "dashboard";

  return out;
}

export function normalizeState(input) {
  const base = structuredCloneSafe(DEFAULTS);
  const tNow = now();

  const src = input && typeof input === "object" ? input : {};

  const merged = { ...base, ...src };

  // arrays
  const actions = Array.isArray(merged.nextActions) ? merged.nextActions : base.nextActions;
  const threads = Array.isArray(merged.threads) ? merged.threads : base.threads;
  const reminders = Array.isArray(merged.reminders) ? merged.reminders : base.reminders;

  merged.nextActions = actions.filter(Boolean).map((a) => normalizeAction(a, tNow));
  merged.threads = threads.filter(Boolean).map((t) => normalizeThread(t, tNow));
  merged.reminders = reminders.filter(Boolean).map((r) => normalizeReminder(r, tNow));

  // objects
  merged.user = merged.user && typeof merged.user === "object" ? merged.user : base.user;
  merged.kpis = merged.kpis && typeof merged.kpis === "object" ? merged.kpis : base.kpis;
  merged.focusNow = merged.focusNow && typeof merged.focusNow === "object" ? merged.focusNow : base.focusNow;
  merged.scratchpad = merged.scratchpad && typeof merged.scratchpad === "object" ? merged.scratchpad : base.scratchpad;
  merged.timer = merged.timer && typeof merged.timer === "object" ? merged.timer : base.timer;

  merged.ui = normalizeUi(merged.ui);
  merged.integrations = normalizeIntegrations(merged.integrations);

  // timer safety
  merged.timer.running = !!merged.timer.running;
  merged.timer.seconds = clampNumber(merged.timer.seconds, 0) ?? 0;

  // scratchpad safety
  merged.scratchpad.text = clampString(merged.scratchpad.text, "");

  // focusNow safety
  merged.focusNow.title = clampString(merged.focusNow.title, base.focusNow.title);
  merged.focusNow.subtitle = clampString(merged.focusNow.subtitle, base.focusNow.subtitle);
  merged.focusNow.current = clampString(merged.focusNow.current, base.focusNow.current);

  return merged;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return normalizeState(null);
    return normalizeState(safeParse(raw));
  } catch {
    return normalizeState(null);
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function storageKey() {
  return KEY;
}

// For App import flow: accept {state:{...}} or raw state object and normalize it
export function normalizeImported(payload) {
  const incoming = payload && typeof payload === "object" && payload.state ? payload.state : payload;
  return normalizeState(incoming);
}

// Utility for analytics
export function daysAgo(ts) {
  return Math.floor((now() - ts) / DAY);
}

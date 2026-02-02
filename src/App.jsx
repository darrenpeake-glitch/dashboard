import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Mail,
  Search,
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BarChart3,
  Users,
  Plus,
  Download,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";

import { loadState, saveState, storageKey } from "./lib/storage";
import { Card, PillButton, MiniLink, Stat } from "./components/ui";

function formatTime(s) {
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function SidebarItem({ icon: Icon, label, active, badge }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer select-none ${
        active ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div
        className={`h-9 w-9 rounded-xl grid place-items-center ${
          active ? "bg-emerald-100" : "bg-white border border-slate-200"
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 text-sm font-semibold">{label}</div>
      {badge ? (
        <div className="text-xs font-bold bg-slate-900 text-white rounded-full px-2 py-0.5">{badge}</div>
      ) : null}
    </div>
  );
}

function now() {
  return Date.now();
}

function matchesSearch(q, ...fields) {
  const s = (q || "").trim().toLowerCase();
  if (!s) return true;
  return fields.some((f) => String(f || "").toLowerCase().includes(s));
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [state, setState] = useState(() => loadState());

  useEffect(() => saveState(state), [state]);

  // Timer tick
  useEffect(() => {
    if (!state.timer.running) return;
    const t = setInterval(() => {
      setState((s) => ({ ...s, timer: { ...s.timer, seconds: s.timer.seconds + 1 } }));
    }, 1000);
    return () => clearInterval(t);
  }, [state.timer.running]);

  const k = state.kpis;

  const weeklyBars = useMemo(() => {
    const base = (k.momentum || 1) + 2;
    return [3, base + 1, base + 2, base + 3, base, base - 1, base + 1].map((v) =>
      Math.max(2, Math.min(10, v))
    );
  }, [k.momentum]);

  // ---- Search + Filters (persisted) ----
  const search = state.ui?.search || "";
  const actionsFilter = state.ui?.actionsFilter || "open"; // open|done|all

  const setSearch = (val) =>
    setState((s) => ({
      ...s,
      ui: { ...(s.ui || {}), search: val },
    }));

  const cycleActionsFilter = () => {
    const next = actionsFilter === "open" ? "done" : actionsFilter === "done" ? "all" : "open";
    setState((s) => ({ ...s, ui: { ...(s.ui || {}), actionsFilter: next } }));
  };

  const clearSearch = () => setSearch("");

  // ---- Lightweight undo for deletes (not persisted) ----
  const [undo, setUndo] = useState(null);
  // undo = { kind: "action"|"thread", item: {...}, index: number, expiresAt: number }
  const undoTimerRef = useRef(null);

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function armUndo(payload) {
    clearUndoTimer();
    const expiresAt = now() + 8000;
    setUndo({ ...payload, expiresAt });
    undoTimerRef.current = setTimeout(() => {
      setUndo(null);
      undoTimerRef.current = null;
    }, 8000);
  }

  function doUndo() {
    if (!undo) return;
    clearUndoTimer();
    setState((s) => {
      if (undo.kind === "action") {
        const next = s.nextActions.slice();
        next.splice(Math.min(Math.max(0, undo.index), next.length), 0, undo.item);
        return { ...s, nextActions: next };
      }
      if (undo.kind === "thread") {
        const next = s.threads.slice();
        next.splice(Math.min(Math.max(0, undo.index), next.length), 0, undo.item);
        return { ...s, threads: next };
      }
      return s;
    });
    setUndo(null);
  }

  // ---- Actions: toggle + add + delete (Alt/Option-click) ----
  const toggleAction = (id) =>
    setState((s) => ({
      ...s,
      nextActions: s.nextActions.map((a) =>
        a.id === id ? { ...a, done: !a.done, updatedAt: now() } : a
      ),
    }));

  const addAction = () => {
    const text = prompt("Next action (keep it tiny):");
    if (!text) return;
    setState((s) => ({
      ...s,
      nextActions: [{ id: crypto.randomUUID(), text, done: false, createdAt: now(), updatedAt: now() }, ...s.nextActions]
        .slice(0, 12),
      kpis: { ...s.kpis, openLoops: Math.max(0, (s.kpis?.openLoops || 0) + 1) },
    }));
  };

  const deleteAction = (id) => {
    setState((s) => {
      const idx = s.nextActions.findIndex((a) => a.id === id);
      if (idx === -1) return s;
      const item = s.nextActions[idx];
      const next = s.nextActions.slice();
      next.splice(idx, 1);
      armUndo({ kind: "action", item, index: idx });
      return { ...s, nextActions: next };
    });
  };

  // ---- Threads: add + "touch" + delete (Alt/Option-click) ----
  const addThread = () => {
    const title = prompt("Thread name:");
    if (!title) return;
    const note = prompt("1-line note (optional):") || "";
    setState((s) => ({
      ...s,
      threads: [{ id: crypto.randomUUID(), title, note, createdAt: now(), updatedAt: now() }, ...s.threads].slice(0, 12),
    }));
  };

  const touchThread = (id) => {
    setState((s) => ({
      ...s,
      threads: s.threads.map((t) => (t.id === id ? { ...t, updatedAt: now() } : t)),
    }));
  };

  const deleteThread = (id) => {
    setState((s) => {
      const idx = s.threads.findIndex((t) => t.id === id);
      if (idx === -1) return s;
      const item = s.threads[idx];
      const next = s.threads.slice();
      next.splice(idx, 1);
      armUndo({ kind: "thread", item, index: idx });
      return { ...s, threads: next };
    });
  };

  // ---- Filtered + sorted views ----
  const shownActions = useMemo(() => {
    let arr = state.nextActions || [];

    if (actionsFilter !== "all") {
      arr = arr.filter((a) => (actionsFilter === "done" ? a.done : !a.done));
    }

    arr = arr.filter((a) => matchesSearch(search, a.text, a.done ? "done" : "open"));

    // Most recently touched at top
    arr = arr.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return arr;
  }, [state.nextActions, actionsFilter, search]);

  const shownThreads = useMemo(() => {
    let arr = state.threads || [];
    arr = arr.filter((t) => matchesSearch(search, t.title, t.note));
    arr = arr.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return arr;
  }, [state.threads, search]);

  // ---- Export/Import JSON (from Add menu) ----
  const importInputRef = useRef(null);

  const doExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      key: storageKey(),
      state,
    };
    const name = `occono-done-export-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(name, payload);
  };

  const doImport = async (file) => {
    const text = await file.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      alert("Import failed: invalid JSON.");
      return;
    }

    // Accept {state:{...}} or raw state object
    const incoming = parsed && typeof parsed === "object" && parsed.state ? parsed.state : parsed;

    if (!incoming || typeof incoming !== "object") {
      alert("Import failed: expected an object.");
      return;
    }

    setUndo(null);
    clearUndoTimer();
    setState(() => incoming);
  };

  const addMenu = () => {
    const choice = prompt(
      [
        "Add menu:",
        "1 = Add Action",
        "2 = Add Thread",
        "3 = Export JSON",
        "4 = Import JSON",
        "",
        "Tip: Alt/Option+Click on an action or thread to DELETE (Undo toast appears).",
      ].join("\n")
    );

    if (!choice) return;
    if (choice.trim() === "1") return addAction();
    if (choice.trim() === "2") return addThread();
    if (choice.trim() === "3") return doExport();
    if (choice.trim() === "4") return importInputRef.current?.click();
  };

  const resetTimer = () => setState((s) => ({ ...s, timer: { running: false, seconds: 0 } }));

  return (
    <div className="min-h-screen p-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) doImport(f);
          e.target.value = "";
        }}
      />

      <div className="max-w-[1280px] mx-auto bg-white rounded-[28px] shadow-soft border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-[280px_1fr] min-h-[760px]">
          <aside className="bg-white border-r border-slate-100 p-5">
            <div className="flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-2xl bg-emerald-100 grid place-items-center">
                <div className="h-5 w-5 rounded-full border-2 border-emerald-700 relative">
                  <div className="h-2 w-2 rounded-full bg-emerald-700 absolute right-0 top-0 translate-x-1/3 -translate-y-1/3" />
                </div>
              </div>

              {/* Title: changed only */}
              <div className="font-extrabold text-lg">Occono Done</div>
            </div>

            <div className="mt-8">
              <div className="text-xs font-bold text-slate-400 px-2 mb-2">MENU</div>
              <div className="space-y-1">
                <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
                <SidebarItem icon={CheckSquare} label="Tasks" badge="12+" />
                <SidebarItem icon={CalendarDays} label="Calendar" />
                <SidebarItem icon={BarChart3} label="Analytics" />
                <SidebarItem icon={Users} label="Team" />
              </div>
            </div>

            <div className="mt-10 bg-gradient-to-br from-slate-950 to-emerald-950 text-white rounded-2xl p-4 mx-2">
              <div className="text-sm font-bold leading-tight">
                Download our
                <br />
                Mobile App
              </div>
              <div className="text-xs text-white/70 mt-2">Get easy in another way</div>
              <button className="mt-4 w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-sm font-bold py-2 inline-flex items-center justify-center gap-2">
                <Download size={16} /> Download
              </button>
            </div>
          </aside>

          <main className="bg-slate-50">
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 w-[420px] max-w-full">
                <Search size={16} className="text-slate-500" />
                <input
                  className="bg-transparent outline-none text-sm w-full"
                  placeholder="Search task"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  className="text-xs font-bold text-slate-400 border border-slate-200 rounded-md px-2 py-1 hover:bg-slate-100"
                  title="Clear search"
                  onClick={clearSearch}
                >
                  ⌘ F
                </button>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white border border-slate-200 grid place-items-center hover:bg-slate-50 cursor-pointer">
                  <Mail size={18} className="text-slate-700" />
                </div>
                <div className="h-10 w-10 rounded-full bg-white border border-slate-200 grid place-items-center hover:bg-slate-50 cursor-pointer">
                  <Bell size={18} className="text-slate-700" />
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-3xl font-extrabold">Dashboard</div>
                  <div className="text-slate-500 mt-1">Control your attention. Close loops. Keep momentum.</div>
                </div>

                <div className="flex items-center gap-3">
                  <PillButton onClick={addMenu}>
                    <Plus size={16} /> Add
                  </PillButton>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-6">
                <Card
                  title="Active Threads"
                  right={<MiniLink />}
                  className="bg-gradient-to-br from-emerald-800 to-emerald-600 text-white border-0"
                >
                  <div className="text-5xl font-extrabold">{k.activeThreads}</div>
                  <div className="mt-2 text-xs text-white/80">What you’re actively juggling</div>
                </Card>

                <Card title="Open Loops" right={<MiniLink />}>
                  <Stat big={k.openLoops} label="Unclosed items" sub="Reduce this to feel lighter" />
                </Card>

                <Card title="Waiting On" right={<MiniLink />}>
                  <Stat big={k.waitingOn} label="Blocked / pending" sub="External dependencies" />
                </Card>

                <Card title="Momentum" right={<MiniLink />}>
                  <Stat big={k.momentum} label="Wins this week" sub="Output > planning" />
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <Card title="Momentum Pattern">
                  <div className="text-xs text-slate-500 mb-3">A lightweight weekly signal (Stage 1)</div>
                  <div className="flex items-end gap-3 h-28">
                    {weeklyBars.map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className={`w-full rounded-2xl ${
                            i === 2 ? "bg-emerald-400" : i === 3 ? "bg-emerald-800" : "bg-slate-200"
                          }`}
                          style={{ height: `${h * 10}px` }}
                        />
                        <div className="text-[10px] text-slate-400 font-bold">{"SMTWTFS"[i]}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Reminders">
                  {state.reminders.map((r) => (
                    <div key={r.id} className="space-y-2">
                      <div className="text-xl font-extrabold text-emerald-900 leading-tight">{r.title}</div>
                      <div className="text-sm text-slate-500">{r.when}</div>
                      <PillButton onClick={() => alert("Stage 1: stub")}>
                        <Play size={16} /> {r.cta}
                      </PillButton>
                    </div>
                  ))}
                </Card>

                <Card
                  title="Next Actions"
                  right={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cycleActionsFilter}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold hover:bg-slate-50"
                        title="Filter actions (cycles Open → Done → All)"
                      >
                        {actionsFilter === "open" ? "Open" : actionsFilter === "done" ? "Done" : "All"}
                      </button>
                      <button
                        onClick={addAction}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold hover:bg-slate-50"
                      >
                        + New
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {shownActions.slice(0, 7).map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 cursor-pointer"
                        title="Tip: Alt/Option+Click to delete (Undo available)"
                        onClick={(e) => {
                          if (e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteAction(a.id);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={a.done}
                          onChange={() => toggleAction(a.id)}
                          className="h-4 w-4"
                        />
                        <div
                          className={`text-sm font-semibold ${
                            a.done ? "line-through text-slate-400" : "text-slate-800"
                          }`}
                        >
                          {a.text}
                        </div>
                      </label>
                    ))}
                    <div className="text-xs text-slate-400 mt-2">Keep these executable. Shrink anything fuzzy.</div>
                    {shownActions.length === 0 ? (
                      <div className="text-xs text-slate-500">No actions match your filter/search.</div>
                    ) : null}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <Card
                  title="Recently Touched Threads"
                  right={
                    <button
                      onClick={addThread}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold hover:bg-slate-50"
                    >
                      + Add
                    </button>
                  }
                >
                  <div className="space-y-3">
                    {shownThreads.slice(0, 8).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start gap-3"
                        title="Click to touch (update recency). Alt/Option+Click to delete (Undo available)."
                        onClick={(e) => {
                          if (e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteThread(t.id);
                            return;
                          }
                          touchThread(t.id);
                        }}
                      >
                        <div className="h-10 w-10 rounded-full bg-emerald-100 grid place-items-center text-emerald-800 font-extrabold">
                          {t.title.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-extrabold">{t.title}</div>
                          <div className="text-xs text-slate-500">{t.note}</div>
                        </div>
                      </div>
                    ))}
                    {shownThreads.length === 0 ? (
                      <div className="text-xs text-slate-500">No threads match your search.</div>
                    ) : null}
                  </div>
                </Card>

                <Card title="Scratchpad Inbox">
                  <textarea
                    value={state.scratchpad.text}
                    onChange={(e) => setState((s) => ({ ...s, scratchpad: { text: e.target.value } }))}
                    className="w-full h-36 rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Dump thoughts here. Sort later."
                  />
                  <div className="flex justify-between mt-3">
                    <div className="text-xs text-slate-500">Auto-saved (localStorage)</div>
                    <button
                      onClick={() => setState((s) => ({ ...s, scratchpad: { text: "" } }))}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900"
                    >
                      Clear
                    </button>
                  </div>
                </Card>

                <div className="bg-gradient-to-br from-slate-950 to-emerald-950 rounded-2xl p-5 text-white shadow-soft border border-slate-900/20">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white/80">Time Tracker</div>
                    <button
                      onClick={resetTimer}
                      className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/15 grid place-items-center"
                      title="Reset"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>

                  <div className="mt-6 text-5xl font-extrabold tracking-tight">{formatTime(state.timer.seconds)}</div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={() => setState((s) => ({ ...s, timer: { ...s.timer, running: !s.timer.running } }))}
                      className="h-12 w-12 rounded-full bg-white grid place-items-center text-slate-950"
                      title={state.timer.running ? "Pause" : "Start"}
                    >
                      {state.timer.running ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {undo ? (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-6 bg-white border border-slate-200 shadow-soft rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div className="text-sm font-semibold text-slate-800">
                    Deleted <span className="font-extrabold">{undo.kind === "action" ? "action" : "thread"}</span>
                  </div>
                  <button
                    onClick={doUndo}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold hover:bg-slate-50"
                  >
                    Undo
                  </button>
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}


import React, { useEffect, useState, useMemo } from "react";

// === Gym överkropp – 4 veckors progression (Dark mode + Kompakt läge) ===
// Nybörjarvänlig webbapp för att planera och logga vikter/reps/sekunder.
// - Dark mode: följer systemläge + manuell växling
// - Kompakt läge: Auto (på små skärmar), På, Av
// Data sparas i localStorage. Exportera som CSV vid behov.

const DEFAULT_EXERCISES = [
  { id: "bench", name: "Bänkpress", scheme: "4×8–10", unit: "kg" },
  { id: "lat", name: "Latsdrag", scheme: "4×8–10", unit: "kg" },
  { id: "db_sh_press", name: "Hantelpress (sittande)", scheme: "3×10–12", unit: "kg" },
  { id: "row", name: "Sittande rodd", scheme: "3×10–12", unit: "kg" },
  { id: "incl_db", name: "Lutande hantelpress", scheme: "3×10–12", unit: "kg" },
  { id: "curl", name: "Bicepscurl", scheme: "3×12", unit: "kg" },
  { id: "pushdown", name: "Triceps pushdown", scheme: "3×12", unit: "kg" },
  { id: "plank", name: "Plankan", scheme: "3×30–45 sek", unit: "sek" },
];

const STORAGE_KEY = "gym_overkropp_v1";
const THEME_KEY = "gym_theme"; // "light" | "dark" | "system"
const COMPACT_KEY = "gym_compact"; // "auto" | "on" | "off"

function roundTo(value, step = 0.5) {
  if (value === null || value === undefined || isNaN(Number(value))) return "";
  const n = Number(value);
  return Math.round(n / step) * step;
}

function clamp(n, a, b) {
  return Math.min(Math.max(n, a), b);
}

// Parse scheme strings like "4×8–10" or "3×12" without regex
function parseScheme(s) {
  if (!s) return { sets: 3, min: 10, max: 12 };
  const parts = s.split("×");
  const sets = parseInt(parts[0], 10) || 3;
  const repsPart = (parts[1] || "").trim();
  const dash = repsPart.includes("–") ? "–" : (repsPart.includes("-") ? "-" : null);
  if (dash) {
    const [minStr, maxStr] = repsPart.split(dash).map(t => t.trim());
    const min = parseInt(minStr, 10) || 10;
    const max = parseInt(maxStr, 10) || min;
    return { sets, min, max };
  }
  const fixed = parseInt(repsPart, 10) || 10;
  return { sets, min: fixed, max: fixed };
}

function toCSV(rows) {
  const header = [
    "Övning",
    "Set×Reps",
    "Start",
    "Mål v1",
    "Utfört v1",
    "Mål v2",
    "Utfört v2",
    "Mål v3",
    "Utfört v3",
    "Mål v4",
    "Utfört v4",
  ];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.name,
        r.scheme,
        r.start ?? "",
        r.targets[0] ?? "",
        r.actuals[0] ?? "",
        r.targets[1] ?? "",
        r.actuals[1] ?? "",
        r.targets[2] ?? "",
        r.actuals[2] ?? "",
        r.targets[3] ?? "",
        r.actuals[3] ?? "",
      ]
        .map((x) => `${x}`.replaceAll(",", ";"))
        .join(",")
    );
  });
  // FIX: använd korrekt radbrytning \n (LF)
  return lines.join("\n");
}

export default function GymOverkroppApp() {
  const [exercises, setExercises] = useState(DEFAULT_EXERCISES);
  const [repsPerWeek, setRepsPerWeek] = useState(1); // reps/vecka (styrkeövningar)
  const [secIncPerWeek, setSecIncPerWeek] = useState(5); // +sek/vecka (plankan)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "system");
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem(COMPACT_KEY) || "auto");

  // Reaktivt system-läge för dark mode
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const mm = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (!mm) return;
    const handler = (e) => setSystemPrefersDark(!!e.matches);
    mm.addEventListener?.("change", handler);
    return () => mm.removeEventListener?.("change", handler);
  }, []);

  // System compact (små skärmar)
  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  useEffect(() => {
    const mm = window.matchMedia && window.matchMedia("(max-width: 640px)");
    if (!mm) return;
    const handler = () => setIsSmallScreen(mm.matches);
    mm.addEventListener?.("change", handler);
    return () => mm.removeEventListener?.("change", handler);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);
  const isCompact = compactMode === "on" || (compactMode === "auto" && isSmallScreen);

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (_) {}
    }
    // default structure
    const base = {};
    DEFAULT_EXERCISES.forEach((e) => {
      base[e.id] = { start: "", actuals: ["", "", "", ""] };
    });
    return base;
  });

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(COMPACT_KEY, compactMode);
  }, [compactMode]);

  const rows = useMemo(() => {
    return exercises.map((e) => {
      const row = data[e.id] || { start: "", actuals: ["", "", "", ""] };
      const start = row.start === "" ? "" : Number(row.start);
      const { min, max } = parseScheme(e.scheme);
      const targets = [0, 1, 2, 3].map((i) => {
        if (e.unit === "sek") {
          if (start === "" || isNaN(start)) return "";
          return Math.round(start + i * secIncPerWeek);
        }
        const reps = min + i * repsPerWeek;
        return clamp(reps, min, max);
      });
      return {
        id: e.id,
        name: e.name,
        scheme: e.scheme,
        unit: e.unit,
        start: row.start,
        targets,
        actuals: row.actuals,
      };
    });
  }, [exercises, data, repsPerWeek, secIncPerWeek]);

  function updateStart(id, value) {
    setData((d) => ({ ...d, [id]: { ...d[id], start: value } }));
  }
  function updateActual(id, weekIndex, value) {
    setData((d) => {
      const prev = d[id] || { start: "", actuals: ["", "", "", ""] };
      const nextActuals = [...prev.actuals];
      nextActuals[weekIndex] = value;
      return { ...d, [id]: { ...prev, actuals: nextActuals } };
    });
  }

  function resetAll() {
    const cleared = {};
    exercises.forEach((e) => (cleared[e.id] = { start: "", actuals: ["", "", "", ""] }));
    setData(cleared);
  }

  function handleExport() {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gym_overkropp_4v.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // UI sizing helpers för kompaktläge
  const pad = isCompact ? "p-2" : "p-3";
  const headPad = isCompact ? "py-2 px-2" : "p-3";
  const tableText = isCompact ? "text-xs" : "text-sm";
  const descText = isCompact ? "text-xs" : "text-sm";
  const headerTitle = isCompact ? "text-xl" : "text-2xl";
  const inputWStart = isCompact ? "w-24" : "w-28";
  const inputWActual = isCompact ? "w-20" : "w-24";

  return (
    <div className={isDark ? "dark" : ""}>
      <div className={`min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100 ${isCompact ? "p-3" : "p-6"} transition-colors`}>
        <div className="mx-auto max-w-6xl">
          <header className={`mb-4 sm:mb-6 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-end sm:justify-between`}>
            <div>
              <h1 className={`${headerTitle} font-bold`}>Överkroppsprogram – 4 veckors progression</h1>
              <p className={`${descText} text-gray-600 dark:text-neutral-300`}>
                Nybörjarvänligt upplägg 2–3 pass/vecka. Spara automatiskt. Justera startvärden och logga
                dina faktiska vikter/tider per vecka.
              </p>
            </div>
            <div className={`flex flex-wrap items-center gap-2 sm:gap-4`}>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Reps/vecka</label>
                <input
                  aria-label="Reps per vecka"
                  type="number"
                  min={1}
                  max={3}
                  step={1}
                  value={repsPerWeek}
                  onChange={(e) => setRepsPerWeek(Number(e.target.value))}
                  className="w-16 rounded-2xl border px-3 py-2 text-sm bg-white dark:bg-neutral-900 dark:border-neutral-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Plankan +sek/vecka</label>
                <input
                  aria-label="Sekunder per vecka"
                  type="number"
                  min={3}
                  max={20}
                  step={1}
                  value={secIncPerWeek}
                  onChange={(e) => setSecIncPerWeek(Number(e.target.value))}
                  className="w-20 rounded-2xl border px-3 py-2 text-sm bg-white dark:bg-neutral-900 dark:border-neutral-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Tema</label>
                <select
                  className={`rounded-2xl border px-3 py-2 text-sm shadow-sm bg-white dark:bg-neutral-900 dark:border-neutral-700`}
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="system">System</option>
                  <option value="light">Ljust</option>
                  <option value="dark">Mörkt</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Kompakt</label>
                <select
                  className={`rounded-2xl border px-3 py-2 text-sm shadow-sm bg-white dark:bg-neutral-900 dark:border-neutral-700`}
                  value={compactMode}
                  onChange={(e) => setCompactMode(e.target.value)}
                >
                  <option value="auto">Auto</option>
                  <option value="on">På</option>
                  <option value="off">Av</option>
                </select>
              </div>

              <button
                onClick={handleExport}
                className={`rounded-2xl border px-3 py-2 text-sm shadow-sm hover:bg-white dark:hover:bg-neutral-800 dark:border-neutral-700`}
              >
                Exportera CSV
              </button>
              <button
                onClick={resetAll}
                className={`rounded-2xl border px-3 py-2 text-sm shadow-sm hover:bg-white dark:hover:bg-neutral-800 dark:border-neutral-700`}
              >
                Nollställ
              </button>
            </div>
          </header>

          <div className={`overflow-x-auto rounded-2xl border bg-white dark:bg-neutral-800 dark:border-neutral-700 shadow`}>
            <table className={`w-full text-left ${tableText}`}>
              <thead className={`bg-gray-100 dark:bg-neutral-800`}>
                <tr>
                  <th className={`${headPad}`}>Övning</th>
                  <th className={`${headPad}`}>Set×Reps</th>
                  <th className={`${headPad}`}>Start</th>
                  <th className={`${headPad}`}>Mål v1</th>
                  <th className={`${headPad}`}>Utfört v1</th>
                  <th className={`${headPad}`}>Mål v2</th>
                  <th className={`${headPad}`}>Utfört v2</th>
                  <th className={`${headPad}`}>Mål v3</th>
                  <th className={`${headPad}`}>Utfört v3</th>
                  <th className={`${headPad}`}>Mål v4</th>
                  <th className={`${headPad}`}>Utfört v4</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-t dark:border-neutral-700`}>
                    <td className={`${pad} font-medium`}>{r.name}</td>
                    <td className={`${pad} text-gray-600 dark:text-neutral-300`}>{r.scheme}</td>
                    <td className={`${pad}`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          className={`${inputWStart} rounded-xl border px-2 py-1 bg-white dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700`}
                          placeholder={r.unit === "kg" ? "kg" : "sek"}
                          value={r.start}
                          onChange={(e) => updateStart(r.id, e.target.value)}
                        />
                        <span className="text-xs text-gray-500 dark:text-neutral-400">{r.unit}</span>
                      </div>
                    </td>
                    {[0, 1, 2, 3].map((w) => (
                      <React.Fragment key={w}>
                        <td className={`${pad} tabular-nums text-gray-800 dark:text-neutral-100`}>
                          {r.targets[w] !== "" ? (
                            <span>
                              {r.targets[w]} <span className="text-xs text-gray-500 dark:text-neutral-400">{r.unit === "sek" ? "sek" : "reps"}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </td>
                        <td className={`${pad}`}>
                          <input
                            type="number"
                            inputMode="decimal"
                            className={`${inputWActual} rounded-xl border px-2 py-1 bg-white dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700`}
                            placeholder={r.unit}
                            value={r.actuals[w]}
                            onChange={(e) => updateActual(r.id, w, e.target.value)}
                          />
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className={`mt-4 sm:mt-6 grid gap-3 sm:gap-4 sm:grid-cols-2`}>
            <div className={`rounded-2xl border bg-white dark:bg-neutral-800 dark:border-neutral-700 ${isCompact ? "p-3" : "p-4"} shadow`}>
              <h2 className="mb-2 text-base font-semibold">Passguide (65–70 min)</h2>
              <ul className={`list-disc pl-5 ${descText} text-gray-700 dark:text-neutral-300`}>
                <li>Uppvärmning 10 min: rodd/crosstrainer + rörlighet.</li>
                <li>
                  Huvudpass: bänkpress, latsdrag, hantelpress, sittande rodd, lutande hantelpress,
                  bicepscurl, triceps pushdown, plankan.
                </li>
                <li>Vila 60–90 sek mellan set. Teknik före vikt.</li>
                <li>Öka <strong>{repsPerWeek} reps/vecka</strong> (håll vikten konstant).</li>
              </ul>
            </div>
            <div className={`rounded-2xl border bg-white dark:bg-neutral-800 dark:border-neutral-700 ${isCompact ? "p-3" : "p-4"} shadow`}>
              <h2 className="mb-2 text-base font-semibold">Tips för snabba resultat</h2>
              <ul className={`list-disc pl-5 ${descText} text-gray-700 dark:text-neutral-300`}>
                <li>Protein: 1.6–2.2 g/kg kroppsvikt per dag.</li>
                <li>Sömn: 7–9 timmar. Minst 1 vilodag mellan passen.</li>
                <li>Logga utfört – små ökningar räknas. Konsekvens slår allt.</li>
              </ul>
            </div>
          </section>

          <footer className={`mt-6 sm:mt-8 text-center text-xs text-gray-500 dark:text-neutral-400`}>
            Byggd för nybörjare – men effektiv även för dig som gör en comeback.
          </footer>
        </div>
      </div>
    </div>
  );
}

// === Enkla testfall (körs i utvecklingsläge – se konsolen) ===
(function runDevTests() {
  try {
    const tests = [];
    const assert = (name, condition) => {
      tests.push({ name, pass: !!condition });
      if (!condition) throw new Error(name);
    };

    // Test 1: toCSV radbrytning
    const rows1 = [{
      name: "A",
      scheme: "1×1",
      start: "10",
      targets: ["11", "12", "13", "14"],
      actuals: ["", "", "", ""],
    }];
    const csv1 = toCSV(rows1);
    assert("toCSV ska innehålla radbrytning", csv1.includes("\n"));
    assert("toCSV två rader (header + data)", csv1.split("\n").length === 2);

    // Test 2: Komma ska ersättas med semikolon inne i celler
    const rows2 = [{
      name: "B, C",
      scheme: "1,2×3",
      start: "10,5",
      targets: ["1,1", "2,2", "3,3", "4,4"],
      actuals: ["", "", "", ""],
    }];
    const csv2 = toCSV(rows2);
    // CSV ska INTE ha kvar kommatecken i cellinnehåll (endast som avskiljare)
    const dataLine = csv2.split("\n")[1];
    const parts = dataLine.split(",");
    assert("toCSV ersätter komman i celler", parts[0] === "B; C" && parts[1] === "1;2×3");

    // Test 3: roundTo 0.5 steg
    assert("roundTo(10.26, 0.5) === 10.5", roundTo(10.26, 0.5) === 10.5);
    assert("roundTo(10.24, 0.5) === 10.0", roundTo(10.24, 0.5) === 10.0);

    // parseScheme tests
    const p1 = parseScheme("4×8–10");
    assert("parseScheme 4×8–10", p1.sets === 4 && p1.min === 8 && p1.max === 10);
    const p2 = parseScheme("3×12");
    assert("parseScheme 3×12", p2.sets === 3 && p2.min === 12 && p2.max === 12);

    console.info("✅ Tester körda:", tests);
  } catch (err) {
    console.error("❌ Testfel:", err);
  }
})();

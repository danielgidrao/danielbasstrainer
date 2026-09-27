import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import correctUrl from "./assets/correct.mp3";
import wrongUrl from "./assets/wrong.mp3";

// --- Teoria / modelo -------------------------------------------------------
// Afinação padrão de baixo 4 cordas (grave -> agudo): Mi, Lá, Ré, Sol
const OPEN = [4, 9, 2, 7]; // índice cromático de cada corda solta (sIdx 0..3)
const NAMES = ["Dó", "Dó♯", "Ré", "Ré♯", "Mi", "Fá", "Fá♯", "Sol", "Sol♯", "Lá", "Lá♯", "Si"];
const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);
const MAX_FRET = 12;

const noteAt = (sIdx: number, f: number) => (OPEN[sIdx] + f) % 12;

type NoteSet = "naturais" | "todas";

interface Cfg {
  noteSet: NoteSet;
  strings: boolean[]; // [Mi, Lá, Ré, Sol]
  fretMin: number;
  fretMax: number;
  showNames: boolean;
}

interface Pos {
  s: number;
  f: number;
}

interface Target {
  n: number;
  positions: Pos[];
}

interface Result {
  type: "ok" | "wrong";
  s: number;
  f: number;
  n: number;
}

interface Stats {
  hits: number;
  misses: number;
  streak: number;
  best: number;
}

function pickTarget(cfg: Cfg, prevNote: number | null): Target | null {
  const valid: { s: number; f: number; n: number }[] = [];
  for (let s = 0; s < 4; s++) {
    if (!cfg.strings[s]) continue;
    for (let f = cfg.fretMin; f <= cfg.fretMax; f++) {
      const n = noteAt(s, f);
      if (cfg.noteSet === "naturais" && !NATURALS.has(n)) continue;
      valid.push({ s, f, n });
    }
  }
  if (valid.length === 0) return null;
  let notes = [...new Set(valid.map((v) => v.n))];
  if (notes.length > 1 && prevNote != null) notes = notes.filter((n) => n !== prevNote);
  const n = notes[Math.floor(Math.random() * notes.length)];
  const positions = valid.filter((v) => v.n === n).map((v) => ({ s: v.s, f: v.f }));
  return { n, positions };
}

// --- Áudio -----------------------------------------------------------------
// Clona o elemento a cada disparo pra permitir sons sobrepostos.
function makePlayer(src: string) {
  const base = new Audio(src);
  base.preload = "auto";
  return () => {
    try {
      const a = base.cloneNode(true) as HTMLAudioElement;
      a.volume = 0.6;
      void a.play().catch(() => {});
    } catch {
      /* ignora navegadores sem suporte */
    }
  };
}
const playCorrect = makePlayer(correctUrl);
const playWrong = makePlayer(wrongUrl);

// --- Cores -----------------------------------------------------------------
const C = {
  page: "#211B13",
  panel: "#2B241A",
  border: "#3A3125",
  woodTop: "#47331F",
  woodBot: "#2E1F10",
  metal: "#9A9AA2",
  nut: "#D9D2C4",
  text: "#EFE9DC",
  muted: "#A99E8A",
  amber: "#E8B44A",
  green: "#6BBE6E",
  red: "#E06A54",
};

// --- Geometria do braço ----------------------------------------------------
const padL = 66,
  padR = 26,
  padT = 30,
  padB = 44;
const fretW = 58,
  strGap = 42,
  dotR = 15;
const nutX = padL;
const boardR = nutX + MAX_FRET * fretW;
const W = boardR + padR;
const H = padT + 3 * strGap + padB;
const rowY = (r: number) => padT + r * strGap; // r = 0..3 de cima p/ baixo
const fretX = (f: number) => nutX + f * fretW;
const noteX = (f: number) => (f === 0 ? nutX - 30 : nutX + (f - 0.5) * fretW);
const sIdxOfRow = (r: number) => 3 - r; // topo = Sol (agudo), base = Mi (grave)
const strWidth = (s: number) => 1.6 + (3 - s) * 0.53; // grave mais grossa

const posText = (s: number, f: number) =>
  `corda ${NAMES[OPEN[s]]}, casa ${f}${f === 0 ? " (solta)" : ""}`;

export default function NoteFinder() {
  const [cfg, setCfg] = useState<Cfg>({
    noteSet: "naturais",
    strings: [true, true, true, true],
    fretMin: 0,
    fretMax: 12,
    showNames: false,
  });
  const [target, setTarget] = useState<Target | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [reveal, setReveal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [stats, setStats] = useState<Stats>({ hits: 0, misses: 0, streak: 0, best: 0 });

  const nextTarget = useCallback(
    (prev: number | null) => {
      setResult(null);
      setReveal(false);
      setTarget(pickTarget(cfg, prev));
    },
    [cfg]
  );

  // novo alvo sempre que os filtros mudam
  useEffect(() => {
    nextTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.noteSet, cfg.strings, cfg.fretMin, cfg.fretMax]);

  const onCell = (s: number, f: number) => {
    if (!target || result?.type === "ok") return;
    const n = noteAt(s, f);
    if (n === target.n) {
      setResult({ type: "ok", s, f, n });
      if (!muted) playCorrect();
      setStats((st) => {
        const streak = st.streak + 1;
        return { ...st, hits: st.hits + 1, streak, best: Math.max(st.best, streak) };
      });
      setTimeout(() => nextTarget(target.n), 850);
    } else {
      setResult({ type: "wrong", s, f, n });
      if (!muted) playWrong();
      setStats((st) => ({ ...st, misses: st.misses + 1, streak: 0 }));
    }
  };

  const activeCell = (s: number, f: number) =>
    cfg.strings[s] && f >= cfg.fretMin && f <= cfg.fretMax;
  const inlays = [3, 5, 7, 9];
  const midY = (rowY(1) + rowY(2)) / 2;

  const btn = (active: boolean): CSSProperties => ({
    padding: "7px 13px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    border: `1px solid ${active ? C.amber : C.border}`,
    background: active ? "rgba(232,180,74,0.14)" : "transparent",
    color: active ? C.amber : C.muted,
    transition: "all .15s",
  });

  return (
    <div
      style={{
        background: C.page,
        color: C.text,
        minHeight: "100%",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: 20,
      }}
    >
      <style>{`
        .cell { transition: fill .12s, stroke .12s; }
        .cell:hover { fill: rgba(232,180,74,0.22) !important; stroke: ${C.amber} !important; }
        @media (prefers-reduced-motion: no-preference){
          .ok { animation: pop .45s ease-out; }
          @keyframes pop { 0%{transform:scale(.6)} 60%{transform:scale(1.18)} 100%{transform:scale(1)} }
        }
      `}</style>

      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {/* topo */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 18,
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 1, color: C.text }}>braço</div>
          <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.muted }}>
            <span>
              acertos <b style={{ color: C.green }}>{stats.hits}</b>
            </span>
            <span>
              erros <b style={{ color: C.red }}>{stats.misses}</b>
            </span>
            <span>
              sequência <b style={{ color: C.amber }}>{stats.streak}</b>
            </span>
            <span>
              recorde <b style={{ color: C.text }}>{stats.best}</b>
            </span>
          </div>
        </div>

        {/* prompt (o "modal" — mostra a nota-alvo) */}
        <div
          style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "20px 24px",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          {target ? (
            <>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Ache no braço</div>
              <div
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 64,
                  lineHeight: 1,
                  color: C.amber,
                  fontWeight: 600,
                }}
              >
                {NAMES[target.n]}
              </div>
              <div
                style={{
                  minHeight: 22,
                  marginTop: 12,
                  fontSize: 15,
                  color: result ? (result.type === "ok" ? C.green : C.red) : C.muted,
                }}
              >
                {result?.type === "ok" && `Boa. ${NAMES[target.n]}: ${posText(result.s, result.f)}.`}
                {result?.type === "wrong" &&
                  `Aí é ${NAMES[result.n]}. A nota é ${NAMES[target.n]} — tenta de novo.`}
                {!result && "Clique na posição certa"}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
                <button style={btn(false)} onClick={() => setReveal((r) => !r)}>
                  {reveal ? "Esconder" : "Revelar"}
                </button>
                <button style={btn(false)} onClick={() => nextTarget(target.n)}>
                  Pular
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: "18px 0", color: C.muted }}>
              Sem notas possíveis com esses filtros. Ative uma corda ou aumente a faixa de casas.
            </div>
          )}
        </div>

        {/* braço */}
        <div
          style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 12,
            overflowX: "auto",
            marginBottom: 16,
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", minWidth: 620 }}>
            <defs>
              <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.woodTop} />
                <stop offset="1" stopColor={C.woodBot} />
              </linearGradient>
            </defs>

            {/* madeira */}
            <rect
              x={nutX}
              y={rowY(0) - 20}
              width={boardR - nutX}
              height={3 * strGap + 40}
              fill="url(#wood)"
              rx="4"
            />

            {/* faixa de casas inativa (sombreada) */}
            {cfg.fretMin > 0 && (
              <rect
                x={nutX}
                y={rowY(0) - 20}
                width={fretX(cfg.fretMin) - nutX}
                height={3 * strGap + 40}
                fill="rgba(0,0,0,0.44)"
              />
            )}
            {cfg.fretMax < MAX_FRET && (
              <rect
                x={fretX(cfg.fretMax)}
                y={rowY(0) - 20}
                width={boardR - fretX(cfg.fretMax)}
                height={3 * strGap + 40}
                fill="rgba(0,0,0,0.44)"
              />
            )}

            {/* inlays */}
            {inlays.map((f) => (
              <circle key={f} cx={noteX(f)} cy={midY} r={5} fill="rgba(217,210,196,0.28)" />
            ))}
            <circle cx={noteX(12)} cy={rowY(0) + 4} r={5} fill="rgba(217,210,196,0.28)" />
            <circle cx={noteX(12)} cy={rowY(3) - 4} r={5} fill="rgba(217,210,196,0.28)" />

            {/* trastes */}
            {Array.from({ length: MAX_FRET }, (_, i) => i + 1).map((f) => (
              <line
                key={f}
                x1={fretX(f)}
                y1={rowY(0) - 20}
                x2={fretX(f)}
                y2={rowY(3) + 20}
                stroke={C.metal}
                strokeWidth={2}
              />
            ))}
            {/* pestana */}
            <line
              x1={nutX}
              y1={rowY(0) - 20}
              x2={nutX}
              y2={rowY(3) + 20}
              stroke={C.nut}
              strokeWidth={6}
            />

            {/* números das casas */}
            {Array.from({ length: MAX_FRET + 1 }, (_, f) => (
              <text key={f} x={noteX(f)} y={H - 16} fill={C.muted} fontSize={12} textAnchor="middle">
                {f}
              </text>
            ))}

            {/* sombreamento de cordas inativas */}
            {[0, 1, 2, 3].map((r) => {
              const s = sIdxOfRow(r);
              if (cfg.strings[s]) return null;
              return (
                <rect
                  key={r}
                  x={nutX - 36}
                  y={rowY(r) - strGap / 2}
                  width={boardR - nutX + 36}
                  height={strGap}
                  fill="rgba(0,0,0,0.44)"
                />
              );
            })}

            {/* cordas + rótulo */}
            {[0, 1, 2, 3].map((r) => {
              const s = sIdxOfRow(r);
              return (
                <g key={r}>
                  <text
                    x={nutX - 46}
                    y={rowY(r) + 4}
                    fill={cfg.strings[s] ? C.text : C.muted}
                    fontSize={14}
                    textAnchor="middle"
                  >
                    {NAMES[OPEN[s]]}
                  </text>
                  <line
                    x1={nutX - 30}
                    y1={rowY(r)}
                    x2={boardR}
                    y2={rowY(r)}
                    stroke={cfg.strings[s] ? "#C9BFA8" : "#5a5140"}
                    strokeWidth={strWidth(s)}
                  />
                </g>
              );
            })}

            {/* posições clicáveis */}
            {[0, 1, 2, 3].map((r) => {
              const s = sIdxOfRow(r);
              return Array.from({ length: MAX_FRET + 1 }, (_, f) => {
                if (!activeCell(s, f)) return null;
                const n = noteAt(s, f);
                const isOk = result?.type === "ok" && result.s === s && result.f === f;
                const isWrong = result?.type === "wrong" && result.s === s && result.f === f;
                const isReveal =
                  reveal && !!target && target.positions.some((p) => p.s === s && p.f === f);
                let fill = "rgba(239,233,220,0.05)";
                let stroke = "rgba(239,233,220,0.22)";
                if (isReveal) {
                  fill = "rgba(232,180,74,0.18)";
                  stroke = C.amber;
                }
                if (isWrong) {
                  fill = "rgba(224,106,84,0.85)";
                  stroke = C.red;
                }
                if (isOk) {
                  fill = "rgba(107,190,110,0.9)";
                  stroke = C.green;
                }
                const label = isOk || isWrong || isReveal || cfg.showNames;
                return (
                  <g
                    key={`${s}-${f}`}
                    onClick={() => onCell(s, f)}
                    className={isOk ? "ok" : ""}
                    style={{ cursor: "pointer", transformOrigin: `${noteX(f)}px ${rowY(r)}px` }}
                  >
                    <circle
                      className="cell"
                      cx={noteX(f)}
                      cy={rowY(r)}
                      r={dotR}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1.5}
                    />
                    {label && (
                      <text
                        x={noteX(f)}
                        y={rowY(r) + 4}
                        fontSize={11}
                        textAnchor="middle"
                        pointerEvents="none"
                        fill={isOk || isWrong ? "#1b1b1b" : C.text}
                      >
                        {NAMES[n]}
                      </text>
                    )}
                  </g>
                );
              });
            })}
          </svg>
        </div>

        {/* ajustes */}
        <div
          style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 22,
            alignItems: "center",
            fontSize: 14,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.muted }}>Notas</span>
            <button
              style={btn(cfg.noteSet === "naturais")}
              onClick={() => setCfg((c) => ({ ...c, noteSet: "naturais" }))}
            >
              Naturais
            </button>
            <button
              style={btn(cfg.noteSet === "todas")}
              onClick={() => setCfg((c) => ({ ...c, noteSet: "todas" }))}
            >
              Todas
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.muted }}>Cordas</span>
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                style={btn(cfg.strings[s])}
                onClick={() =>
                  setCfg((c) => {
                    const strings = [...c.strings];
                    strings[s] = !strings[s];
                    if (strings.some(Boolean)) return { ...c, strings };
                    return c;
                  })
                }
              >
                {NAMES[OPEN[s]]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: C.muted }}>Casas</span>
            <select
              value={cfg.fretMin}
              onChange={(e) =>
                setCfg((c) => ({ ...c, fretMin: Math.min(+e.target.value, c.fretMax) }))
              }
              style={{
                background: C.page,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "5px 8px",
              }}
            >
              {Array.from({ length: MAX_FRET + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <span style={{ color: C.muted }}>a</span>
            <select
              value={cfg.fretMax}
              onChange={(e) =>
                setCfg((c) => ({ ...c, fretMax: Math.max(+e.target.value, c.fretMin) }))
              }
              style={{
                background: C.page,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "5px 8px",
              }}
            >
              {Array.from({ length: MAX_FRET + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <label
            style={{ display: "flex", gap: 7, alignItems: "center", color: C.muted, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={cfg.showNames}
              onChange={(e) => setCfg((c) => ({ ...c, showNames: e.target.checked }))}
            />
            Mostrar nomes no braço
          </label>

          <button
            style={{ ...btn(!muted), marginLeft: "auto" }}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? "Som: off" : "Som: on"}
          </button>

          <button
            style={btn(false)}
            onClick={() => setStats({ hits: 0, misses: 0, streak: 0, best: 0 })}
          >
            Zerar placar
          </button>
        </div>
      </div>
    </div>
  );
}

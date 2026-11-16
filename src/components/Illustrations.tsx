import type { ReactNode } from "react";

const CLOUD = "M58 124 C30 124 24 94 48 88 C46 62 78 52 96 70 C106 46 144 46 152 72 C178 62 202 78 190 102 C210 106 206 126 186 126 Z";

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg className="illus" viewBox="0 0 240 170" fill="none" stroke="var(--outline)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const Bird = ({ x = 0, y = 0, s = 1 }: { x?: number; y?: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M150 105 C150 80 120 72 100 82 C84 90 84 112 100 120 C118 130 150 128 150 105Z" fill="#ffd45e" />
    <path d="M150 100 L176 90 L168 112 Z" fill="#ffd45e" />
    <path d="M86 96 L68 102 L86 107Z" fill="#ff9f43" />
    <path d="M110 100 C122 91 138 97 134 112 C126 115 114 113 110 100Z" fill="#fff4c2" />
    <circle cx="97" cy="94" r="2.6" fill="var(--outline)" stroke="none" />
    <path d="M112 128 v14 M126 129 v13" />
  </g>
);
const Glass = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}><circle cx="0" cy="0" r="20" fill="rgba(160,210,255,.35)" /><path d="M14 14 L34 34" strokeWidth="5" /></g>
);
const Sun = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}><circle r="9" fill="#ffd45e" /><path d="M0 -17 V-13 M0 13 V17 M-17 0 H-13 M13 0 H17 M-12 -12 L-9 -9 M12 12 L9 9 M12 -12 L9 -9 M-12 12 L-9 9" /></g>
);

export const NotFoundArt = () => (
  <Frame><path d="M20 150 H220" strokeDasharray="2 9" /><Sun x={200} y={34} /><Bird x={26} y={4} /><Glass x={60} y={84} />
    <path d="M30 40 q10 -10 20 0 M60 28 q9 -9 18 0" /><text x="108" y="58" fontSize="26" fill="var(--outline)" stroke="none" fontFamily="Gaegu, cursive">?</text></Frame>
);
export const ForbiddenArt = () => (
  <Frame><path d={CLOUD} fill="var(--card-bg)" transform="translate(0 -20)" />
    <path d="M90 78 l10 4 M150 78 l-10 4" /><circle cx="97" cy="92" r="3" fill="var(--outline)" stroke="none" /><circle cx="143" cy="92" r="3" fill="var(--outline)" stroke="none" />
    <path d="M108 104 q12 -6 24 0" />
    <rect x="98" y="118" width="44" height="34" rx="5" fill="#ffd45e" /><path d="M106 118 v-10 a14 14 0 0 1 28 0 v10" /><circle cx="120" cy="134" r="4" fill="var(--outline)" stroke="none" /></Frame>
);
export const ServerErrorArt = () => (
  <Frame><g transform="translate(-6 0)"><path d="M58 124 C30 124 24 94 48 88 C46 62 78 52 96 66 L104 82 L94 96 L106 110 L98 124 Z" fill="var(--card-bg)" /></g>
    <g transform="translate(8 6)"><path d="M104 82 L114 70 C126 48 146 48 152 72 C178 62 202 78 190 102 C210 106 206 126 186 126 L104 126 L112 110 L100 96 Z" fill="var(--card-bg)" /></g>
    <path d="M96 22 l-6 14 h10 l-6 14 M140 20 l5 8 M150 36 l9 -2" stroke="#ff9f43" /><path d="M110 150 q10 -10 20 0" /><path d="M70 106 q4 8 0 12" stroke="#4dabf7" /></Frame>
);
export const EmptySkyArt = () => (
  <Frame><path d={CLOUD} strokeDasharray="3 8" transform="translate(-4 -12) scale(.95)" /><path d="M150 34 q8 -8 16 0 q8 -8 16 0" /><Sun x={44} y={36} /><path d="M20 150 H220" strokeDasharray="2 9" /></Frame>
);
export const EmptySearchArt = () => (
  <Frame><circle cx="108" cy="78" r="38" fill="rgba(160,210,255,.3)" /><path d="M136 106 L172 142" strokeWidth="7" /><path d="M94 70 v6 M122 70 v6 M94 98 q14 -12 28 0" />
    <path d="M30 44 q9 -9 18 0 q9 -9 18 0" strokeDasharray="3 6" /></Frame>
);
export const OfflineArt = () => (
  <Frame><path d={CLOUD} fill="var(--card-bg)" transform="translate(0 -14)" /><path d="M92 116 q28 -26 56 0 M104 128 q16 -14 32 0" /><circle cx="120" cy="140" r="3" fill="var(--outline)" />
    <path d="M70 60 L170 150" stroke="#ff6b6b" strokeWidth="4" /></Frame>
);
export const LogoMark = () => (
  <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="var(--outline)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="26" cy="13" r="7" fill="#ffd45e" /><path d="M9 31a6 6 0 0 1 1-11.8 8.5 8.5 0 0 1 16 2.4A4.8 4.8 0 0 1 27 31z" fill="var(--card-bg)" />
  </svg>
);

const TINTS = ["#d6efff", "#fff0c4", "#ffe1d2", "#dcf5e4", "#e0f0f7", "#fde9c9"];
const DOODLES = [
  "M30 78 C20 78 18 62 30 59 C30 44 52 40 60 52 C70 40 92 46 94 62 C106 62 106 78 94 78Z", // cloud
  "M60 30 l9 20 22 2 -17 14 6 22 -20 -12 -20 12 6 -22 -17 -14 22 -2z", // star
  "M60 72 C60 60 76 60 76 50 C76 38 56 36 50 46 C42 58 54 74 70 70 C88 66 92 44 78 32", // spiral
  "M26 70 L94 34 L66 82 L58 60 Z M58 60 L94 34", // paper plane
  "M60 24 L86 52 L60 80 L34 52 Z M60 80 L60 96 M60 90 q-8 4 -12 10 M60 92 q8 4 12 10", // kite
  "M34 34 l-16 20 16 20 M86 34 l16 20 -16 20 M68 30 l-16 48", // code brackets
];
export function Doodle({ seed }: { seed: number }) {
  return (
    <svg className="doodle" viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="120" height="100" fill={TINTS[seed % TINTS.length]} />
      <path d={DOODLES[(seed >> 3) % DOODLES.length]} fill="rgba(255,255,255,.7)" stroke="#1d3557" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

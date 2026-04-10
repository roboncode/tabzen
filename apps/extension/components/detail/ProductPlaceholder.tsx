import { Show } from "solid-js";

interface ProductPlaceholderProps {
  name: string;
  favicon: string | null;
  index: number;
}

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// ── SVG Patterns (5) ──

function Topographic(p: { id: string }) {
  const offsets = [150, 130, 110, 90, 70, 50];
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 225" class="absolute inset-0" style={{ opacity: 0.12 }}>
      {offsets.map((base, i) => (
        <path
          d={`M0,${base} Q50,${base - 20 - i * 5} 100,${base - 10 + i * 2} T200,${base - 10 + i * 3} T300,${base + 5 - i * 2} T400,${base - 25 - i * 4}`}
          fill="none" stroke="white" stroke-width="1.5"
        />
      ))}
    </svg>
  );
}

function DotGrid(p: { id: string }) {
  const dots: { x: number; y: number }[] = [];
  for (let y = 35; y < 220; y += 40)
    for (let x = 40; x < 400; x += 40)
      dots.push({ x, y });
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 225" class="absolute inset-0">
      <defs>
        <radialGradient id={`dg-${p.id}`} cx="50%" cy="50%" r="40%">
          <stop offset="0%" stop-color="white" stop-opacity="0.06" />
          <stop offset="100%" stop-color="transparent" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#dg-${p.id})`} />
      <g fill="rgba(255,255,255,0.06)">{dots.map((d) => <circle cx={d.x} cy={d.y} r="1.5" />)}</g>
    </svg>
  );
}

function Circuit(p: { id: string; seed: number }) {
  const s = p.seed;
  const y1 = 60 + (s % 50);
  const y2 = 40 + ((s >> 4) % 80);
  const x1 = 80 + (s % 60);
  const x2 = 200 + ((s >> 3) % 80);
  const x3 = 300 + ((s >> 5) % 60);
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 225" class="absolute inset-0" style={{ opacity: 0.15 }}>
      <path d={`M0,112 H${x1} V${y1} H${x2} V112 H${x3} V170 H400`} fill="none" stroke="white" stroke-width="1.5" />
      <path d={`M0,${y1} H${x1 - 40} V170 H${x2 - 40} V${y2} H${x3 - 20} V${y2 + 40} H400`} fill="none" stroke="white" stroke-width="1.5" />
      <circle cx={x1} cy={y1} r="3.5" fill="white" opacity="0.3" />
      <circle cx={x2} cy={112} r="3.5" fill="white" opacity="0.3" />
      <circle cx={x3} cy={170} r="3.5" fill="white" opacity="0.3" />
      <circle cx={x1 - 40} cy={170} r="3.5" fill="white" opacity="0.3" />
    </svg>
  );
}

function IsoHex(p: { id: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 225" class="absolute inset-0">
      <defs>
        <pattern id={`ih-${p.id}`} width="40" height="46" patternUnits="userSpaceOnUse">
          <path d="M20,0 L40,12 L40,34 L20,46 L0,34 L0,12 Z" fill="none" stroke="white" stroke-width="0.7" opacity="0.08" />
        </pattern>
        <radialGradient id={`ihg-${p.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="white" stop-opacity="0.05" />
          <stop offset="100%" stop-color="transparent" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#ih-${p.id})`} />
      <rect width="400" height="225" fill={`url(#ihg-${p.id})`} />
    </svg>
  );
}

function Rings(p: { id: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 400 225" class="absolute inset-0">
      {[30, 55, 80, 105, 130, 155].map((r, i) => (
        <circle cx="200" cy="112" r={r} fill="none" stroke={`rgba(255,255,255,${0.07 - i * 0.01})`} stroke-width="1" />
      ))}
    </svg>
  );
}

// ── Text Placement Styles (8) ──

interface TextPlacement {
  style: Record<string, string>;
  fontSize: string;
  useFullName: boolean; // false = single giant letter
}

const TEXT_PLACEMENTS: TextPlacement[] = [
  // 0: Bottom-right bleed
  { style: { position: "absolute", bottom: "-16px", right: "12px", "line-height": "1", "letter-spacing": "-4px", "white-space": "nowrap" }, fontSize: "110px", useFullName: true },
  // 1: Top-left bleed
  { style: { position: "absolute", top: "-20px", left: "-8px", "line-height": "1", "letter-spacing": "-5px", "white-space": "nowrap" }, fontSize: "120px", useFullName: true },
  // 2: Center-bottom crop
  { style: { position: "absolute", bottom: "-30px", left: "50%", transform: "translateX(-50%)", "line-height": "1", "letter-spacing": "-4px", "white-space": "nowrap" }, fontSize: "120px", useFullName: true },
  // 3: Right-center bleed
  { style: { position: "absolute", top: "50%", right: "-20px", transform: "translateY(-50%)", "line-height": "1", "letter-spacing": "-3px", "white-space": "nowrap" }, fontSize: "100px", useFullName: true },
  // 4: Diagonal bottom-left
  { style: { position: "absolute", bottom: "-10px", left: "-10px", "line-height": "1", "letter-spacing": "-3px", "white-space": "nowrap", transform: "rotate(-8deg)", "transform-origin": "bottom left" }, fontSize: "100px", useFullName: true },
  // 5: Top-center crop
  { style: { position: "absolute", top: "-35px", left: "50%", transform: "translateX(-50%)", "line-height": "1", "letter-spacing": "-4px", "white-space": "nowrap" }, fontSize: "110px", useFullName: true },
  // 6: Bottom-left anchored
  { style: { position: "absolute", bottom: "-8px", left: "16px", "line-height": "1", "letter-spacing": "-3px", "white-space": "nowrap" }, fontSize: "80px", useFullName: true },
  // 7: Giant single letter top-right
  { style: { position: "absolute", top: "-40px", right: "-30px", "line-height": "1" }, fontSize: "260px", useFullName: false },
];

const PATTERN_COUNT = 5;
const PLACEMENT_COUNT = TEXT_PLACEMENTS.length;

export default function ProductPlaceholder(props: ProductPlaceholderProps) {
  const hash = () => nameHash(props.name);
  const uid = () => `pp-${props.index}`;

  // Use index for pattern, hash+index for placement — guarantees adjacent cards differ
  const patternIndex = () => props.index % PATTERN_COUNT;
  const placementIndex = () => (props.index + (hash() % (PLACEMENT_COUNT - 1) + 1)) % PLACEMENT_COUNT;

  const placement = () => TEXT_PLACEMENTS[placementIndex()];
  const displayText = () => placement().useFullName ? props.name : props.name[0];

  const renderPattern = () => {
    const id = uid();
    const seed = hash();
    switch (patternIndex()) {
      case 0: return <Topographic id={id} />;
      case 1: return <DotGrid id={id} />;
      case 2: return <Circuit id={id} seed={seed} />;
      case 3: return <IsoHex id={id} />;
      case 4: return <Rings id={id} />;
      default: return <DotGrid id={id} />;
    }
  };

  return (
    <div class="w-full h-full relative flex items-center justify-center" style={{ background: "hsl(0, 0%, 13%)" }}>
      {renderPattern()}

      {/* Clipped text */}
      <div
        style={{
          ...placement().style,
          "font-size": placement().fontSize,
          "font-weight": "800",
          color: "rgba(255, 255, 255, 0.08)",
        }}
      >
        {displayText()}
      </div>

    </div>
  );
}

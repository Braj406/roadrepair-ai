import { useId } from "react";

// Brand mark: a road that curves into an "R", with a location pin and a crack.
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  // Unique id per copy, so a hidden logo elsewhere on the page can't break this one's gradient.
  const gid = `rr-bg-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7b5cff" />
          <stop offset="1" stopColor="#2c1e86" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gid})`} />
      {/* R stem + bowl shaped as a road */}
      <path
        d="M14 52 L22 16 H38 C47 16 50 30 40 33 L33 35"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M17.5 47 L19 40 M21 31 L22.5 24" stroke="#3a2a9c" strokeWidth="1.8" strokeLinecap="round" />
      {/* R leg as a cracked slab */}
      <path d="M31 38 L44 38 L50 52 L34 52 Z" fill="#fff" />
      <path d="M38 41 L40 45 L37 47 L41 50 M40 45 L44 46" stroke="#2c1e86" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Pin */}
      <path d="M46 4 C41.6 4 39 7.2 39 10.6 C39 15.4 46 22 46 22 C46 22 53 15.4 53 10.6 C53 7.2 50.4 4 46 4 Z" fill="#f59e2c" />
      <circle cx="46" cy="10.6" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        RoadRepair <span className={light ? "text-[#b9a8ff]" : "text-brand"}>AI</span>
      </span>
    </div>
  );
}

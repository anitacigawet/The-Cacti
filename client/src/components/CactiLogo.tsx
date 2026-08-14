/**
 * The Cacti Logo - A cactus with a surveillance eye
 * Used as the masthead for the AI-generated newspaper
 */
export function CactiLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cactus body */}
      <rect x="48" y="30" width="24" height="60" rx="12" fill="oklch(0.45 0.15 155)" stroke="oklch(0.60 0.18 155)" strokeWidth="1.5" />
      
      {/* Left arm */}
      <path
        d="M48 55 H36 Q28 55 28 47 V40 Q28 34 34 34 Q40 34 40 40 V48 H48"
        fill="oklch(0.45 0.15 155)"
        stroke="oklch(0.60 0.18 155)"
        strokeWidth="1.5"
      />
      
      {/* Right arm */}
      <path
        d="M72 50 H84 Q92 50 92 42 V38 Q92 32 86 32 Q80 32 80 38 V43 H72"
        fill="oklch(0.45 0.15 155)"
        stroke="oklch(0.60 0.18 155)"
        strokeWidth="1.5"
      />
      
      {/* Cactus spines - subtle lines */}
      <line x1="44" y1="38" x2="40" y2="35" stroke="oklch(0.60 0.18 155)" strokeWidth="0.8" />
      <line x1="44" y1="48" x2="40" y2="46" stroke="oklch(0.60 0.18 155)" strokeWidth="0.8" />
      <line x1="76" y1="40" x2="80" y2="37" stroke="oklch(0.60 0.18 155)" strokeWidth="0.8" />
      <line x1="76" y1="50" x2="80" y2="48" stroke="oklch(0.60 0.18 155)" strokeWidth="0.8" />
      <line x1="44" y1="68" x2="40" y2="66" stroke="oklch(0.60 0.18 155)" strokeWidth="0.8" />
      <line x1="76" y1="65" x2="80" y2="63" stroke="oklch(0.60 0.18 155)" strokeWidth="0.8" />
      
      {/* Eye - centered on cactus body */}
      <ellipse cx="60" cy="52" rx="10" ry="7" fill="oklch(0.12 0.01 260)" stroke="oklch(0.78 0.15 195)" strokeWidth="1.5" />
      
      {/* Iris */}
      <circle cx="60" cy="52" r="4.5" fill="oklch(0.78 0.15 195)" />
      
      {/* Pupil */}
      <circle cx="60" cy="52" r="2" fill="oklch(0.12 0.01 260)" />
      
      {/* Eye highlight */}
      <circle cx="62" cy="50.5" r="1" fill="oklch(0.95 0.01 195)" opacity="0.8" />
      
      {/* Eye glow */}
      <ellipse cx="60" cy="52" rx="10" ry="7" fill="none" stroke="oklch(0.78 0.15 195 / 30%)" strokeWidth="3" />
      
      {/* Ground / pot */}
      <rect x="40" y="88" width="40" height="8" rx="2" fill="oklch(0.30 0.04 50)" stroke="oklch(0.40 0.06 50)" strokeWidth="1" />
      <rect x="44" y="84" width="32" height="6" rx="1" fill="oklch(0.35 0.05 50)" stroke="oklch(0.40 0.06 50)" strokeWidth="1" />
      
      {/* Scan line effect on eye */}
      <line x1="50" y1="52" x2="70" y2="52" stroke="oklch(0.78 0.15 195 / 20%)" strokeWidth="0.5">
        <animate attributeName="y1" values="45;59;45" dur="3s" repeatCount="indefinite" />
        <animate attributeName="y2" values="45;59;45" dur="3s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

/**
 * Inline version for newspaper masthead - wider format
 */
export function CactiMasthead({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <CactiLogo size={56} />
      <div className="text-center">
        <h1
          className="text-4xl md:text-5xl font-black tracking-tight"
          style={{
            fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
            letterSpacing: "-0.02em",
          }}
        >
          THE CACTI
        </h1>
        <div
          className="text-xs tracking-[0.3em] uppercase text-muted-foreground mt-0.5"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Public Records and Regional News
        </div>
      </div>
      <CactiLogo size={56} className="scale-x-[-1]" />
    </div>
  );
}

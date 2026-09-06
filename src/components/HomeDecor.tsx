/** Decorative drawings for the home page — no text, aria-hidden by parents. */

export function HomeHeroAtmosphere() {
  return (
    <div className="home-hero__atmosphere" aria-hidden>
      <div className="home-hero__glow home-hero__glow--a" />
      <div className="home-hero__glow home-hero__glow--b" />
      <div className="home-hero__glow home-hero__glow--c" />
      <div className="home-hero__pattern" />

      <svg className="home-hero__filigree home-hero__filigree--tl" viewBox="0 0 120 120" fill="none">
        <path
          d="M18 18c28 4 48 22 54 48M18 18c8 26 28 44 52 52M18 42c16 2 28 14 32 30M42 18c2 16 14 28 30 32"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="18" cy="18" r="3" fill="currentColor" />
        <circle cx="72" cy="66" r="2.2" fill="currentColor" opacity="0.7" />
      </svg>
      <svg className="home-hero__filigree home-hero__filigree--tr" viewBox="0 0 120 120" fill="none">
        <path
          d="M102 18c-28 4-48 22-54 48M102 18c-8 26-28 44-52 52M102 42c-16 2-28 14-32 30M78 18c-2 16-14 28-30 32"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="102" cy="18" r="3" fill="currentColor" />
        <circle cx="48" cy="66" r="2.2" fill="currentColor" opacity="0.7" />
      </svg>

      <svg className="home-hero__pedigree" viewBox="0 0 440 440" fill="none">
        <path
          d="M220 36v86M220 122L92 214M220 122l128 92M92 214v86M348 214v86M92 300L40 378M92 300l52 78M348 300l-52 78M348 300l52 78M220 122V88"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
        <circle cx="220" cy="30" r="16" fill="currentColor" opacity="0.62" />
        <circle cx="92" cy="214" r="12" fill="currentColor" opacity="0.42" />
        <circle cx="348" cy="214" r="12" fill="currentColor" opacity="0.42" />
        <circle cx="40" cy="378" r="9" fill="currentColor" opacity="0.28" />
        <circle cx="144" cy="378" r="9" fill="currentColor" opacity="0.28" />
        <circle cx="296" cy="378" r="9" fill="currentColor" opacity="0.28" />
        <circle cx="400" cy="378" r="9" fill="currentColor" opacity="0.28" />
        <circle cx="220" cy="122" r="6" fill="currentColor" opacity="0.35" />
      </svg>

      <div className="home-hero__motes">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`home-hero__mote home-hero__mote--${(i % 4) + 1}`} />
        ))}
      </div>
    </div>
  );
}

export function HomeSectionRule() {
  return (
    <div className="home-rule" aria-hidden>
      <span className="home-rule__line" />
      <svg className="home-rule__gem" viewBox="0 0 28 16" fill="none">
        <path d="M2 8h8M18 8h8M14 2.5 17.2 8 14 13.5 10.8 8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
      <span className="home-rule__line" />
    </div>
  );
}

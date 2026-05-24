/**
 * AuthLayout — Shared layout wrapper for Login and Register pages.
 *
 * Provides:
 * - Animated gradient background with floating orbs
 * - Grid pattern overlay
 * - Glassmorphism card container
 * - Brand header with microscope icon
 *
 * Styled with Tailwind CSS v4 utility classes.
 *
 * @module components/AuthLayout
 */

/**
 * SVG Microscope icon for brand header.
 * @returns {JSX.Element}
 */
function MicroscopeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 1 0 0-14h-1" />
      <path d="M9 14h2" />
      <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
      <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    </svg>
  );
}

/**
 * AuthLayout component.
 *
 * @param {object} props
 * @param {string} props.title - Page heading
 * @param {string} props.subtitle - Subheading text
 * @param {React.ReactNode} props.children - Form content
 * @returns {JSX.Element}
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <>
      {/* ── Animated background ── */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-[#0a0e1a]">
        {/* Floating orbs */}
        <div className="absolute -top-[200px] -right-[200px] w-[800px] h-[800px] rounded-full
          bg-[radial-gradient(circle,rgba(99,102,241,0.15),transparent_70%)]
          animate-[float-orb_20s_ease-in-out_infinite]" />
        <div className="absolute -bottom-[150px] -left-[150px] w-[600px] h-[600px] rounded-full
          bg-[radial-gradient(circle,rgba(6,182,212,0.12),transparent_70%)]
          animate-[float-orb_25s_ease-in-out_infinite_reverse]" />

        {/* Extra orbs */}
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full
          bg-[rgba(139,92,246,0.12)] blur-[80px] opacity-50
          animate-[float-orb_18s_ease-in-out_infinite]"
          style={{ animationDelay: '-5s' }} />
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] rounded-full
          bg-[rgba(14,165,233,0.1)] blur-[80px] opacity-50
          animate-[float-orb_22s_ease-in-out_infinite]"
          style={{ animationDelay: '-10s' }} />
        <div className="absolute bottom-[20%] right-[35%] w-[250px] h-[250px] rounded-full
          bg-[rgba(236,72,153,0.08)] blur-[80px] opacity-50
          animate-[float-orb_28s_ease-in-out_infinite]"
          style={{ animationDelay: '-15s' }} />

        {/* Grid pattern overlay */}
        <div className="grid-overlay absolute inset-0
          bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]
          bg-[length:60px_60px]" />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-[440px]
          bg-[rgba(17,24,39,0.7)] backdrop-blur-[24px] backdrop-saturate-[180%]
          border border-subtle rounded-3xl
          px-6 py-8 sm:px-10 sm:py-10
          shadow-[0_8px_32px_rgba(0,0,0,0.5)]
          animate-[card-enter_0.6s_cubic-bezier(0.16,1,0.3,1)_forwards]
          opacity-0 translate-y-5">

          {/* Brand */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
              bg-gradient-to-br from-primary to-accent mb-4
              shadow-[0_0_30px_var(--color-primary-glow)]
              animate-[icon-pulse_3s_ease-in-out_infinite] text-white">
              <MicroscopeIcon />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight
              bg-gradient-to-br from-txt to-accent bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-sm text-txt-secondary mt-1">{subtitle}</p>
          </div>

          {/* Page-specific content */}
          {children}
        </div>
      </div>
    </>
  );
}

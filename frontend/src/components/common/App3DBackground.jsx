import React, { useEffect, useState } from 'react';

/**
 * App3DBackground
 * Universal 3D atmospheric depth background for BioTrajectory pages and dashboards.
 * Features:
 * - 3D Perspective horizon plane receding into the distance
 * - Floating 3D volumetric light orbs with multi-depth parallax
 * - Subtle underlying 3D DNA rotating double-helix telemetry
 * - Non-interactive (pointer-events-none, select-none, z-0)
 * - Light and Dark theme harmonization
 * - Accessible with prefers-reduced-motion support
 */
export default function App3DBackground({
  variant = 'default', // 'default' | 'subtle' | 'dashboard'
  showVideo = true,
  fixed = false,
  className = ''
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const motionHandler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', motionHandler);

    return () => {
      mediaQuery.removeEventListener('change', motionHandler);
    };
  }, []);

  const isSubtle = variant === 'subtle';

  return (
    <div
      aria-hidden="true"
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 z-0 overflow-hidden pointer-events-none select-none perspective-3d-space ${className}`}
    >
      {/* 1. Underlying 3D DNA Rotating Double Helix */}
      {showVideo && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          {prefersReducedMotion ? (
            <img
              src="/videos/dna_dashboard_bg_still.jpg"
              alt=""
              className="w-full h-full object-cover object-center opacity-20 dark:opacity-45 dark:mix-blend-screen transition-opacity duration-700"
            />
          ) : (
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/videos/dna_dashboard_bg_still.jpg"
              className="w-full h-full object-cover object-center opacity-20 dark:opacity-45 dark:mix-blend-screen transition-opacity duration-700"
            >
              <source src="/videos/dna_dashboard_bg.mp4" type="video/mp4" />
            </video>
          )}

          {/* Theme overlay to preserve 100% card & text readability */}
          <div className="absolute inset-0 block dark:hidden bg-[#F6F0E4]/80 backdrop-blur-[0.5px]" />
          <div className="absolute inset-0 hidden dark:block bg-[#1F150E]/45" />
        </div>
      )}

      {/* Theme Vignette Edge Falloff */}
      <div className="absolute inset-0 z-1 bg-radial-gradient from-transparent via-transparent to-[#F6F0E4]/70 dark:to-[#1F150E]/80" />
    </div>
  );
}

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

      {/* 2. 3D Perspective Grid Horizon Plane */}
      <div className="bg-3d-grid-plane z-1" />

      {/* 3. Floating 3D Volumetric Orbs in Multi-depth Parallax */}
      <div className="absolute inset-0 z-2 overflow-hidden">
        {/* Orb 1: Upper-Right Cyan / Baby Blue Luminous Volume */}
        <div
          className={`orb-3d w-[450px] h-[450px] -top-24 -right-24 bg-gradient-to-br from-[#A9D6F5]/30 to-[#45A3E2]/15 dark:from-[#A9D6F5]/20 dark:to-[#1C5885]/15 ${
            prefersReducedMotion ? '' : 'animate-3d-float'
          }`}
          style={{ transform: 'translateZ(40px)' }}
        />

        {/* Orb 2: Lower-Left Warm Amber/Brown Volumetric Depth */}
        <div
          className={`orb-3d w-[500px] h-[500px] -bottom-36 -left-36 bg-gradient-to-tr from-[#6B4F3A]/25 to-[#D8C8B5]/20 dark:from-[#36261B]/40 dark:to-[#2B1E15]/20 ${
            prefersReducedMotion ? '' : 'animate-3d-float-slow'
          }`}
          style={{ transform: 'translateZ(-30px)' }}
        />

        {/* Orb 3: Center Ambient Depth Core */}
        {!isSubtle && (
          <div
            className={`orb-3d w-[350px] h-[350px] top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#A9D6F5]/15 dark:bg-[#A9D6F5]/10 ${
              prefersReducedMotion ? '' : 'animate-float-delayed'
            }`}
            style={{ transform: 'translateZ(15px)' }}
          />
        )}
      </div>

      {/* 4. Soft Vignette Edge Falloff for Perfect UI Contrast */}
      <div className="absolute inset-0 z-3 bg-radial-gradient from-transparent via-transparent to-[#F6F0E4]/70 dark:to-[#1F150E]/80" />
    </div>
  );
}

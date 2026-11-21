import React, { useEffect, useState } from 'react';

/**
 * UserDashboardBackground
 * Subtle decorative DNA helix background video (gettyimages-1500469735) for BioTrajectory user dashboard.
 * - Watermark removed (both center text and bottom-left ID).
 * - Original video contents and blue/cyan colors preserved intact (no recoloring).
 * - Enhanced with 3D perspective horizon plane and floating volumetric depth orbs.
 * - Placed behind page content; non-interactive (pointer-events-none).
 * - Subtle theme overlay to preserve 100% readability of cards, charts, and text.
 * - Responsive with still poster fallback and prefers-reduced-motion support.
 */
export default function UserDashboardBackground() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // 1. Listen for reduced motion system preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const motionHandler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', motionHandler);

    return () => {
      mediaQuery.removeEventListener('change', motionHandler);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none flex items-center justify-center perspective-3d-space"
    >
      {/* 1. Underlying Video or Static Reduced-Motion Poster (Original Colors Preserved) */}
      {prefersReducedMotion ? (
        <img
          src="/videos/dna_dashboard_bg_still.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-30 dark:opacity-55 dark:mix-blend-screen transition-opacity duration-700"
        />
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/videos/dna_dashboard_bg_still.jpg"
          className="w-full h-full object-cover object-center opacity-30 dark:opacity-55 dark:mix-blend-screen transition-opacity duration-700"
        >
          <source src="/videos/dna_dashboard_bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* 2. Light Theme Treatment: Subtle Existing Cream (#F6F0E4) Overlay for 100% Card & Text Readability */}
      <div className="absolute inset-0 block dark:hidden bg-[#F6F0E4]/75 backdrop-blur-[0.5px] pointer-events-none z-3" />

      {/* 5. Dark Theme Treatment: Subtle Existing Walnut (#1F150E) Overlay to Keep Telemetry High-Contrast */}
      <div className="absolute inset-0 hidden dark:block bg-[#1F150E]/40 pointer-events-none z-3" />

      {/* 6. Soft Vignette Edge Falloff */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#F6F0E4]/80 dark:to-[#1F150E]/80 pointer-events-none z-4" />
    </div>
  );
}

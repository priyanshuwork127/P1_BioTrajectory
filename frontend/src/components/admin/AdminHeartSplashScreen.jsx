import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Ultra-sharp web-optimized textures with seamless alpha feathering & 2K resolution
const cardioHologramImg = '/splash/hologram_body_faded.png';
const heartCutoutImg = '/splash/heart_cutout_hd.png';
const heartDepthImg = '/splash/heart_depth_hd.png';

export default function AdminHeartSplashScreen({ onComplete }) {
  const mountRef = useRef(null);
  const audioCtxRef = useRef(null);

  const [screenShake, setScreenShake] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);

  // Synthesize realistic heartbeat "lub-dub" audio
  const playHeartBeat = (accent = false) => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // "Lub" (first low-frequency ventricular contraction)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(accent ? 115 : 85, now);
      osc1.frequency.exponentialRampToValueAtTime(32, now + 0.16);

      gain1.gain.setValueAtTime(accent ? 0.38 : 0.24, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      // "Dub" (second aortic valve closure)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(accent ? 140 : 105, now + 0.14);
      osc2.frequency.exponentialRampToValueAtTime(45, now + 0.28);

      gain2.gain.setValueAtTime(accent ? 0.32 : 0.19, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.32);
    } catch {
      // Audio autoplay handled
    }
  };

  // Synthesize the massive cinematic "DHOOM" impact explosion sound
  const playDhoomSound = () => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // 1. Heavy Sub-Bass Core Drop (150Hz -> 26Hz deep chest rumble)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(150, now);
      subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.95);

      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.35);

      // 2. Punch Transient (Snappy triangle distortion)
      const punchOsc = ctx.createOscillator();
      const punchGain = ctx.createGain();
      punchOsc.type = 'triangle';
      punchOsc.frequency.setValueAtTime(240, now);
      punchOsc.frequency.exponentialRampToValueAtTime(35, now + 0.28);

      punchGain.gain.setValueAtTime(0.65, now);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      punchOsc.connect(punchGain);
      punchGain.connect(ctx.destination);
      punchOsc.start(now);
      punchOsc.stop(now + 0.42);

      // 3. Filtered Cinematic White-Noise Whoosh & Shimmer
      const bufferSize = ctx.sampleRate * 0.9;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.85);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.48, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.92);
    } catch {
      // Audio autoplay handled
    }
  };

  useEffect(() => {
    let animationFrameId;
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, High-Precision WebGL Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060d);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Start fully zoomed out so the whole body and silhouette are visible comfortably centered
    camera.position.set(0, 0, 7.0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. 3D Lighting setup for realistic cardiac illumination
    const ambientLight = new THREE.AmbientLight(0x0a192c, 1.6);
    scene.add(ambientLight);

    const cyanPointLight = new THREE.PointLight(0x00d9ff, 4.5, 10);
    cyanPointLight.position.set(0.06, -0.23, 1.4);
    scene.add(cyanPointLight);

    const purplePointLight = new THREE.PointLight(0x8b5cf6, 3.2, 8);
    purplePointLight.position.set(0.5, -0.6, 0.9);
    scene.add(purplePointLight);

    // 3. Texture Loading (Optimized high-resolution assets with soft borders)
    const textureLoader = new THREE.TextureLoader();

    // Background: Faded-border silhouette image (seamless vignette into dark canvas)
    const bgTexture = textureLoader.load(cardioHologramImg);
    bgTexture.colorSpace = THREE.SRGBColorSpace;
    bgTexture.anisotropy = maxAnisotropy;
    bgTexture.minFilter = THREE.LinearMipmapLinearFilter;
    bgTexture.generateMipmaps = true;

    // Plane geometry matching 736 / 1030 aspect ratio
    const bgH = 3.6;
    const bgW = bgH * (736 / 1030); // ~2.572
    const bgGeo = new THREE.PlaneGeometry(bgW, bgH);
    const bgMat = new THREE.MeshBasicMaterial({
      map: bgTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 0, 0);
    scene.add(bgMesh);

    // 4. Ultra-HD Anatomical Heart (Razor-sharp cutout & depth displacement)
    const heartHdTexture = textureLoader.load(heartCutoutImg);
    heartHdTexture.colorSpace = THREE.SRGBColorSpace;
    heartHdTexture.anisotropy = maxAnisotropy;
    heartHdTexture.minFilter = THREE.LinearMipmapLinearFilter;
    heartHdTexture.magFilter = THREE.LinearFilter;
    heartHdTexture.generateMipmaps = true;

    const heartDepthTexture = textureLoader.load(heartDepthImg);
    heartDepthTexture.anisotropy = maxAnisotropy;

    // Heart 3D dimensions placed directly over the chest
    const heartW = 0.77;
    const heartH = 0.88;
    const heartGeo = new THREE.PlaneGeometry(heartW, heartH, 128, 128);

    // Target coordinates of the anatomical heart center
    const targetX = 0.06;
    const targetY = -0.23;

    // Advanced Material with dynamic depth displacement and specular glint
    const heartMat = new THREE.MeshStandardMaterial({
      map: heartHdTexture,
      displacementMap: heartDepthTexture,
      displacementScale: 0.18,
      transparent: true,
      opacity: 1.0,
      roughness: 0.2,
      metalness: 0.15,
      emissive: new THREE.Color(0x00d9ff),
      emissiveMap: heartHdTexture,
      emissiveIntensity: 0.85,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(targetX, targetY, 0.06);
    scene.add(heartMesh);

    // Additive Glow Layer for pulsating luminous coronary micro-vessels
    const glowMat = new THREE.MeshBasicMaterial({
      map: heartHdTexture,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowMesh = new THREE.Mesh(heartGeo.clone(), glowMat);
    glowMesh.position.set(targetX, targetY, 0.08);
    scene.add(glowMesh);

    // 3D Cardiac Shockwave Ring (for the DHOOM finale)
    const shockwaveGeo = new THREE.RingGeometry(0.12, 0.22, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockwaveMesh.position.set(targetX, targetY, 0.16);
    scene.add(shockwaveMesh);

    // Timeline Configuration (Full cinematic 4.6s sequence)
    const startTime = performance.now();
    const duration = 4600; // 4.6s total sequence
    let lastBeatTime = 0;
    let dhoomTriggered = false;

    const animate = (time) => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = time - startTime;

      // Realistic 75 BPM "lub-dub" cardiac contraction cycle
      const beatPeriod = 800;
      const beatPhase = (elapsed % beatPeriod) / beatPeriod;
      let pulseScale = 1.0;
      let pulseGlow = 0.85;

      if (beatPhase < 0.14) {
        // Ventricular Systole (Lub)
        const t = beatPhase / 0.14;
        pulseScale = 1.0 + Math.sin(t * Math.PI) * 0.20;
        pulseGlow = 0.85 + Math.sin(t * Math.PI) * 0.75;
      } else if (beatPhase >= 0.22 && beatPhase < 0.35) {
        // Aortic Snap (Dub)
        const t = (beatPhase - 0.22) / 0.13;
        pulseScale = 1.0 + Math.sin(t * Math.PI) * 0.14;
        pulseGlow = 0.85 + Math.sin(t * Math.PI) * 0.45;
      }

      // Audio beat trigger
      if (elapsed - lastBeatTime >= beatPeriod && elapsed < 3700) {
        lastBeatTime = elapsed;
        playHeartBeat(elapsed > 1800);
      }

      // Dynamic 3D Heart Movement & Breathing Parallax
      const breath = Math.sin(elapsed * 0.002) * 0.03;
      heartMesh.scale.set(pulseScale, pulseScale, pulseScale + breath);
      glowMesh.scale.set(pulseScale * 1.04, pulseScale * 1.04, pulseScale);
      heartMat.emissiveIntensity = pulseGlow;
      glowMat.opacity = pulseGlow * 0.6;
      cyanPointLight.intensity = 4.0 * pulseGlow;

      // Realistic 3D tilt movement of the actual heart in space
      heartMesh.rotation.y = Math.sin(elapsed * 0.0016) * 0.14;
      heartMesh.rotation.x = Math.cos(elapsed * 0.0022) * 0.09;
      glowMesh.rotation.y = heartMesh.rotation.y;
      glowMesh.rotation.x = heartMesh.rotation.x;

      // TIMELINE STAGES:
      if (elapsed < 1400) {
        // 1. FULL BODY ZOOMED OUT: Silhouette clearly centered in space
        camera.position.set(0, 0, 7.0);
        camera.lookAt(0, 0, 0);
        heartMat.displacementScale = 0.18;
      } else if (elapsed >= 1400 && elapsed < 2600) {
        // 2. SMOOTH ACCELERATING ZOOM DIRECTLY INTO THE HEART
        const t = (elapsed - 1400) / 1200;
        const smoothT = t * t * (3 - 2 * t);

        camera.position.x = THREE.MathUtils.lerp(0, targetX, smoothT);
        camera.position.y = THREE.MathUtils.lerp(0, targetY, smoothT);
        camera.position.z = THREE.MathUtils.lerp(7.0, 2.4, smoothT);
        camera.lookAt(targetX, targetY, 0);

        // Quality and displacement enhance as camera zooms closer
        heartMat.displacementScale = 0.18 + smoothT * 0.08;
      } else if (elapsed >= 2600 && elapsed < 3750) {
        // 3. ULTRA-CRISP 3D HEART CLOSE-UP (Fills screen with razor-sharp 2K clarity)
        const t = (elapsed - 2600) / 1150;
        const easeIn = t * t * t;

        camera.position.x = targetX;
        camera.position.y = targetY;
        camera.position.z = THREE.MathUtils.lerp(2.4, 0.70, easeIn);
        camera.lookAt(targetX, targetY, 0);

        // Maximize crispness, specular sheen, and displacement details
        heartMat.displacementScale = 0.26 + easeIn * 0.18;
        heartMat.roughness = Math.max(0.08, 0.2 - easeIn * 0.12);
        renderer.toneMappingExposure = 1.35 + easeIn * 0.65;
        bgMat.opacity = Math.max(0.05, 1.0 - easeIn * 0.95);
      } else {
        // 4. "DHOOM" EXPLOSIVE IMPACT FINALE! (3750ms -> 4600ms)
        if (!dhoomTriggered) {
          dhoomTriggered = true;
          playDhoomSound();
          setScreenShake(true);
          setFlashOpacity(1.0);
        }

        const tDhoom = Math.min((elapsed - 3750) / 850, 1);

        // Heart expands with super-nova power
        const boomScale = 1.0 + tDhoom * 7.5;
        heartMesh.scale.set(boomScale, boomScale, boomScale);
        glowMesh.scale.set(boomScale * 1.25, boomScale * 1.25, boomScale);

        // Expanding 3D Shockwave ring
        shockwaveMat.opacity = Math.max(0, 1.0 - tDhoom * 1.3);
        shockwaveMesh.scale.set(1.0 + tDhoom * 32.0, 1.0 + tDhoom * 32.0, 1.0);

        // Dissolving white-cyan energy flash into dashboard
        setFlashOpacity(Math.max(0, 1.0 - tDhoom * 0.75));

        if (elapsed >= duration) {
          cancelAnimationFrame(animationFrameId);
          if (onComplete) onComplete();
          return;
        }
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Press Escape to Skip immediately
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onComplete) onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      bgGeo.dispose();
      bgMat.dispose();
      heartGeo.dispose();
      heartMat.dispose();
      glowMat.dispose();
      shockwaveGeo.dispose();
      shockwaveMat.dispose();
      renderer.dispose();
    };
  }, [onComplete]);

  return (
    <div
      onClick={() => onComplete && onComplete()}
      className={`fixed inset-0 z-50 overflow-hidden bg-[#04060d] cursor-pointer select-none ${
        screenShake ? 'animate-shake' : ''
      }`}
      title="Click or press ESC to skip"
    >
      {/* 1. Full WebGL 3D Canvas Mount (All HUD boxes, particles, and overlay clutter removed) */}
      <div ref={mountRef} className="absolute inset-0 z-10" />

      {/* 2. Soft Ambient Radial Vignette (Seamless fade into deep space) */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#04060d]/20 to-[#04060d]/80 pointer-events-none z-15" />

      {/* 3. "DHOOM" Supernova Energy Flash & Reveal into Dashboard */}
      <div
        className="fixed inset-0 z-30 pointer-events-none bg-gradient-to-br from-cyan-100 via-white to-cyan-200 transition-opacity duration-300"
        style={{
          opacity: flashOpacity
        }}
      />
    </div>
  );
}

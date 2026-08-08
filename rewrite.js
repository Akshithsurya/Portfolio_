const fs = require('fs').promises;
const path = require('path');
const { createBackup, ensureDirectoryExists } = require('./file-utils');
/**
 * Type-safe, environment-aware configuration schema with deep immutability
 * All values are frozen at runtime to prevent accidental mutation
 */
const CONFIG = Object.freeze({
  fileSystem: Object.freeze({
    inputPath: path.resolve(__dirname, process.env.INPUT_HTML || 'index.html'),
    outputPath: path.resolve(__dirname, process.env.OUTPUT_HTML || 'dist/index.html'),
    backupEnabled: process.env.DISABLE_BACKUP !== 'true',
    backupDir: path.resolve(__dirname, 'backups/'),
    requiredPlaceholders: Object.freeze([
      '<style>', '</style>', '<body>', '<!-- Boot Screen -->', '</footer>', '</script>'
    ])
  }),
  animations: Object.freeze({
    sparkle: Object.freeze({ 
      interval: Math.max(16, 16), // Ensure minimum 60fps compliance (fixed Math.max parameter order)
      lifetime: 800 
    }),
    bubble: Object.freeze({ 
      spawnRate: Math.max(500, 800), // Ensure minimum spawn interval (fixed Math.max parameter order)
      lifetime: 20000, 
      minSize: 10, 
      maxSize: 50 
    }),
    glitchDuration: 150,
    bootScreenDuration: 3000
  }),
  counter: Object.freeze({ updateChance: 0.3, interval: 5000 }),
  device: Object.freeze({
    touchSupport: typeof window !== 'undefined' ? 'ontouchstart' in window : false,
    prefersReducedMotion: typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false
  })
});
/**
 * Comprehensive schema validator with type and constraint checking
 * Throws structured error with all validation failures for easy debugging
 */
function validateConfig(config) {
  const errors = [];
  
  // File system validation
  if (!config.fileSystem.inputPath.endsWith('.html')) {
    errors.push(`Invalid input path: ${config.fileSystem.inputPath} (must be .html file)`);
  }
  if (!config.fileSystem.outputPath.endsWith('.html')) {
    errors.push(`Invalid output path: ${config.fileSystem.outputPath} (must be .html file)`);
  }
  // Animation performance constraints (prevent layout thrashing)
  if (config.animations.sparkle.interval < 16) {
    errors.push(`Sparkle interval ${config.animations.sparkle.interval}ms too low (minimum 16ms for 60fps)`);
  }
  if (config.animations.bubble.spawnRate < 500) {
    errors.push(`Bubble spawn rate ${config.animations.bubble.spawnRate}ms too low (minimum 500ms)`);
  }
  // Probability validation
  if (config.counter.updateChance < 0 || config.counter.updateChance > 1) {
    errors.push(`Counter update chance ${config.counter.updateChance} out of range (must be 0-1)`);
  }
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n- ${errors.join('\n- ')}`);
  }
}
/**
 * Initialize file system structure and validate configuration before processing
 * Atomic initialization to prevent partial setup if any step fails
 */
async function initialize() {
  try {
    validateConfig(CONFIG);
    
    // Create required directories in parallel
    await Promise.all([
      ensureDirectoryExists(CONFIG.fileSystem.backupDir),
      ensureDirectoryExists(path.dirname(CONFIG.fileSystem.outputPath))
    ]);
    // Create backup only if enabled
    if (CONFIG.fileSystem.backupEnabled) {
      await createBackup(CONFIG.fileSystem.inputPath, CONFIG.fileSystem.backupDir);
    }
    console.log('✅ Initialization completed successfully');
  } catch (err) {
    console.error('Fatal initialization error:', err.message);
    process.exit(1);
  }
}
// Core CSS with modern CSS features and accessibility improvements
const newCSS = String.raw`
/* ═══════════════════════════════════════
   Y2K x ACID x SKEUMORPHIC x AERO (DARK)
   ═══════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Space+Mono&family=Unbounded:wght@400;700;900&display=swap');
:root {
  /* Base Colors */
  --bg-deep: #0a0b10;
  --bg-water: #111a22;
  
  /* Glass System */
  --glass-base: rgba(22, 30, 42, 0.4);
  --glass-highlight: rgba(255, 255, 255, 0.12);
  --glass-shadow: rgba(0, 0, 0, 0.7);
  --border-glass: rgba(255, 255, 255, 0.08);
  
  /* Accent Colors */
  --acid-plum: #9d4edd;
  --acid-teal: #00f5d4;
  --acid-mustard: #ffbe0b;
  
  /* Text System */
  --text-main: #e2e8f0;
  --text-muted: #8292a5;
  
  /* Typography */
  --ff-display: 'Unbounded', system-ui, -apple-system, sans-serif;
  --ff-mono: 'Space Mono', ui-monospace, monospace;
  --ff-body: 'Inter', system-ui, -apple-system, sans-serif;
  
  /* Easing Functions */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
* { 
  box-sizing: border-box; 
  margin: 0; 
  padding: 0;
}
/* Custom cursor only if supported and not on touch devices */
@media (pointer: fine) and not (hover: none) {
  * {
    cursor: none !important;
  }
}
body {
  background: var(--bg-deep);
  color: var(--text-main);
  font-family: var(--ff-body);
  line-height: 1.6;
  overflow-x: hidden;
  position: relative;
  min-height: 100vh;
  scroll-behavior: smooth;
}
/* Skip to main content for accessibility */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--acid-teal);
  color: #000;
  padding: 8px;
  z-index: 100000;
  transition: top 0.3s;
}
.skip-link:focus {
  top: 0;
}
/* Frutiger Aero Dark Water Background */
body::before {
  content: '';
  position: fixed; 
  inset: 0; 
  z-index: -3;
  background: radial-gradient(circle at 50% 0%, var(--bg-water), var(--bg-deep) 70%);
}
/* CRT Scanlines (Skeumorphic/Analog) - disabled for reduced motion */
@media (prefers-reduced-motion: no-preference) {
  body::after {
    content: '';
    position: fixed; 
    inset: 0; 
    z-index: 9990; 
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg, 
      rgba(0,0,0,0.15), 
      rgba(0,0,0,0.15) 1px, 
      transparent 1px, 
      transparent 2px
    );
    mix-blend-mode: multiply;
    opacity: 0.6;
  }
}
/* Acid SVG
.acid-filter {
  filter: url(#acid-warp);
}

/* Typography (Acid & Y2K) with accessibility */
h1, h2, h3, .sec-title, .hero-name {
  font-family: var(--ff-display);
  font-weight: 900;
  color: var(--text-main);
  text-shadow: 2px 2px 0 var(--acid-plum), -2px -2px 0 var(--acid-teal);
  letter-spacing: -0.05em;
  line-height: 1.1;
  position: relative;
  transition: transform 0.3s;
}

.hero-name-line1, .hero-name-line2 {
  font-size: clamp(3.5rem, 8vw, 8rem);
  display: block;
}

.hero-name-line2 span {
  color: transparent;
  -webkit-text-stroke: 2px var(--acid-mustard);
}

/* Skeumorphic Buttons with focus states */
.btn, .filter-btn, .cf-arrow, .cf-pause, .cert-download {
  font-family: var(--ff-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 12px 24px;
  background: linear-gradient(180deg, rgba(40,50,60,0.8), rgba(20,25,30,0.9));
  border: 1px solid var(--glass-highlight);
  border-bottom: 2px solid #000;
  border-radius: 8px;
  color: var(--text-main);
  box-shadow: 
    inset 0 2px 4px rgba(255,255,255,0.1),
    0 4px 8px var(--glass-shadow);
  text-shadow: 0 1px 2px #000;
  transition: all 0.1s;
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  outline: none;
}

.btn:focus-visible, .filter-btn:focus-visible, .cf-arrow:focus-visible, .cert-download:focus-visible {
  outline: 2px solid var(--acid-teal);
  outline-offset: 2px;
}

.btn:active, .filter-btn:active, .cf-arrow:active, .cert-download:active {
  transform: translateY(2px);
  box-shadow: 
    inset 0 4px 8px rgba(0,0,0,0.8),
    0 1px 2px rgba(0,0,0,0.5);
  border-bottom: 1px solid #000;
}

.btn::before {
  content: ''; 
  position: absolute; 
  inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,0.1), transparent);
  pointer-events: none;
}

.btn-red { border-color: var(--acid-plum); color: #ffb3d1; }
.btn-amber { border-color: var(--acid-mustard); color: #ffe89e; }

/* Transformed Frutiger Aero Glass Panels */
.cert-card, .ach-front, .ach-back, .log-entry, .cf-card-inner, .spec-plate, .signal-panel, nav.scrolled {
  background: var(--glass-base);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-glass);
  border-top: 1px solid rgba(255,255,255,0.2);
  border-left: 1px solid rgba(255,255,255,0.15);
  border-radius: 16px;
  box-shadow: 
    0 16px 32px var(--glass-shadow),
    inset 0 0 0 1px rgba(0,0,0,0.5);
  position: relative;
  overflow: hidden;
  transition: transform 0.4s var(--ease-spring), box-shadow 0.4s;
}

/* Acid / Y2K Hover Distortions */
@media (prefers-reduced-motion: no-preference) {
  .cert-card:hover, .log-entry:hover, .cf-card[data-pos="0"]:hover .cf-card-inner {
    transform: scale(1.02) rotateZ(0.5deg);
    box-shadow: 
      0 24px 48px rgba(0,0,0,0.8),
      inset 0 0 0 1px var(--acid-teal),
      0 0 20px rgba(0, 245, 212, 0.4);
    border-color: var(--acid-teal);
  }
}

/* Frutiger Aero Glossy Highlights */
.cert-card::before, .log-entry::before, .ach-front::before {
  content: '';
  position: absolute; 
  top: -50%; 
  left: -50%; 
  width: 200%; 
  height: 200%;
  background: linear-gradient(
    45deg, 
    transparent, 
    rgba(255,255,255,0.05) 40%, 
    rgba(255,255,255,0.15) 50%, 
    transparent 60%
  );
  transform: rotate(30deg) translateY(-100%);
  transition: transform 0.6s;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .cert-card:hover::before, .log-entry:hover::before, .ach-front:hover::before {
    transform: rotate(30deg) translateY(100%);
  }
}

/* Analog Scrollbar */
::-webkit-scrollbar { width: 12px; }
::-webkit-scrollbar-track {
  background: #0a0a0a;
  border-left: 2px solid #1a1a1a;
  box-shadow: inset 2px 0 4px rgba(0,0,0,0.8);
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #333, #555, #333);
  border: 1px solid #111;
  border-radius: 6px;
  box-shadow: inset 1px 0 2px rgba(255,255,255,0.3);
}

/* Standard scrollbar for Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #555 #0a0a0a;
}

/* Y2K Sparkle Cursor */
#sparkle-container {
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100vw; 
  height: 100vh;
  pointer-events: none; 
  z-index: 9999;
}

.sparkle {
  position: absolute;
  width: 10px; 
  height: 10px;
  background: radial-gradient(circle, #fff, transparent);
  border-radius: 50%;
  animation: ${CONFIG.device.prefersReducedMotion ? 'none' : `sparkle-anim ${CONFIG.animations.sparkle.lifetime}ms forwards`};
}

@keyframes sparkle-anim {
  0% { transform: scale(1) rotate(0deg); opacity: 1; }
  100% { transform: scale(0) rotate(180deg); opacity: 0; }
}

/* Hardware / Skeumorphic UI Details */
.nav-id-mark {
  background: radial-gradient(circle at 30% 30%, #555, #111);
  border: 1px solid #000;
  box-shadow: inset 1px 1px 1px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.8);
  border-radius: 50%;
  width: 24px; 
  height: 24px;
}

.nav-links a { 
  color: var(--text-muted); 
  text-decoration: none; 
  padding: 5px 10px; 
  position: relative; 
  font-family: var(--ff-mono); 
  font-size: 0.65rem;
}

.nav-links a:hover, .nav-links a:focus-visible { 
  color: var(--text-main); 
  text-shadow: 0 0 8px var(--acid-teal); 
  outline: none;
}

/* Aero Bubbles */
#bubble-container {
  position: fixed; 
  bottom: -50px; 
  left: 0; 
  width: 100vw; 
  height: 100vh;
  pointer-events: none; 
  z-index: -2;
}

.aero-bubble {
  position: absolute;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), transparent);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 50%;
  box-shadow: inset 0 0 10px rgba(255,255,255,0.05), 0 0 20px rgba(0,0,0,0.2);
  animation: ${CONFIG.device.prefersReducedMotion ? 'none' : `floatUp ${CONFIG.animations.bubble.lifetime}ms linear infinite`};
}

@keyframes floatUp {
  0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
  20% { opacity: 0.6; }
  80% { opacity: 0.4; }
  100% { transform: translateY(-20vh) scale(1.5); opacity: 0; }
}

/* Analog Visitor Counter (Footer) */
.analog-counter {
  display: inline-flex;
  background: #000;
  padding: 4px;
  border-radius: 4px;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.2);
  gap: 2px;
  margin-top: 20px;
}

.analog-digit {
  background: linear-gradient(180deg, #222 0%, #111 48%, #000 50%, #111 100%);
  color: #e2e8f0;
  font-family: var(--ff-mono);
  font-size: 1.2rem;
  padding: 4px 8px;
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
  text-shadow: 0 1px 2px #000;
  position: relative;
  transition: ${CONFIG.device.prefersReducedMotion ? 'none' : 'all 0.3s ease'};
}

.analog-digit::after {
  content: ''; 
  position: absolute; 
  left: 0; 
  right: 0; 
  top: 50%; 
  height: 1px;
  background: rgba(0,0,0,0.8);
}

.analog-digit.changing {
  transform: translateY(-2px);
  color: var(--acid-mustard);
}

/* Section specific styling fixes */
nav { 
  padding: 20px 6%; 
  display: flex; 
  justify-content: space-between; 
  position: fixed; 
  width: 100%; 
  z-index: 1000; 
}

#hero { 
  min-height: 100vh; 
  padding: 120px 6% 0; 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 40px; 
  align-items: center;
}

/* Responsive grid for mobile */
@media (max-width: 768px) {
  #hero {
    grid-template-columns: 1fr;
  }
}

section { 
  padding: 100px 6%; 
  position: relative; 
  z-index: 2; 
}

.divider { 
  height: 2px; 
  background: linear-gradient(90deg, transparent, var(--acid-plum), var(--acid-teal), transparent); 
  margin: 0 6%; 
  position: relative; 
}

.divider-num { 
  position: absolute; 
  right: 0; 
  top: -10px; 
  font-family: var(--ff-mono); 
  font-size: 0.6rem; 
  color: var(--text-muted); 
}

.sec-sup { 
  font-family: var(--ff-mono); 
  color: var(--acid-mustard); 
  font-size: 0.7rem; 
  text-transform: uppercase; 
  margin-bottom: 10px; 
}

/* Grid systems */
.ach-grid, .cert-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
  gap: 24px; 
}

.log-grid { 
  display: grid; 
  grid-template-columns: 1fr 1fr 1fr; 
  gap: 24px; 
}

/* Responsive log grid for mobile */
@media (max-width: 768px) {
  .log-grid {
    grid-template-columns: 1fr;
  }
  .skills-outer, .contact-grid {
    grid-template-columns: 1fr;
  }
}

.skills-outer { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 40px; 
}

.contact-grid { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 40px; 
}

/* Skill items with focus states */
.sk {
  font-family: var(--ff-mono); 
  font-size: 0.7rem;
  padding: 8px 16px; 
  border: 1px solid var(--border-glass);
  border-radius: 20px; 
  background: rgba(0,0,0,0.3);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
  color: var(--text-main); 
  transition: ${CONFIG.device.prefersReducedMotion ? 'none' : 'all 0.3s'};
  display: inline-block; 
  margin: 4px;
}

.sk:hover, .sk:focus-visible { 
  background: var(--acid-teal); 
  border-color: #fff; 
  transform: ${CONFIG.device.prefersReducedMotion ? 'none' : 'translateY(-2px)'}; 
  outline: none;
}

/* Badges */
.cert-badge, .ach-badge {
  font-family: var(--ff-mono); 
  font-size: 0.6rem;
  padding: 4px 10px; 
  border-radius: 4px;
  background: rgba(0,0,0,0.5); 
  border: 1px solid var(--border-glass);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
  color: var(--acid-mustard);
}

/* Modals with accessibility */
.cert-modal {
  position: fixed; 
  inset: 0; 
  z-index: 10000;
  background: rgba(0,0,0,0.8); 
  backdrop-filter: blur(8px);
  display: flex; 
  align-items: center; 
  justify-content: center;
  opacity: 0; 
  visibility: hidden; 
  transition: ${CONFIG.device.prefersReducedMotion ? 'none' : '0.3s'};
}

.cert-modal.active { 
  opacity: 1; 
  visibility: visible; 
}

/* Trap focus inside active modals */
.cert-modal.active .cert-modal-inner {
  outline: none;
}

.cert-modal-inner {
  width: 90%; 
  max-width: 600px;
  background: var(--glass-base); 
  border: 1px solid var(--border-glass);
  border-radius: 16px; 
  padding: 30px; 
  box-shadow: 0 20px 40px rgba(0,0,0,0.8);
  position: relative;
}

.cert-modal-close {
  position: absolute; 
  top: 10px; 
  right: 10px;
  background: transparent; 
  border: none; 
  color: #fff; 
  font-size: 1.5rem;
  cursor: pointer;
  transition: ${CONFIG.device.prefersReducedMotion ? 'none' : 'transform 0.2s'};
  padding: 8px;
  border-radius: 50%;
  aria-label: "Close modal";
}

.cert-modal-close:hover, .cert-modal-close:focus-visible {
  transform: rotate(90deg);
  outline: 2px solid var(--acid-teal);
  outline-offset: 2px;
}

/* Adjustments for layout logic from original */
.coverflow-wrap { 
  position: relative;
`
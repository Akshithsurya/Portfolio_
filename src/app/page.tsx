'use client'

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react'
import { initRoomScene, type RoomScene, type SceneState } from '@/lib/room-scene'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function getReduced() {
  return window.matchMedia(REDUCED_QUERY).matches
}
function getReducedServer() {
  return false
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduced, getReduced, getReducedServer)
}

export default function Home() {
  const webglRef = useRef<HTMLDivElement>(null)
  const css3dRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RoomScene | null>(null)

  const [booting, setBooting] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sceneState, setSceneState] = useState<SceneState>('loading')
  const [hovering, setHovering] = useState(false)
  const [a11yMode, setA11yMode] = useState(false)
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null)
  const reduced = usePrefersReducedMotion()

  // boot + init scene
  useEffect(() => {
    if (a11yMode) return
    if (!webglRef.current || !css3dRef.current) return
    let cancelled = false

    const minBootMs = 1400
    const t0 = performance.now()

    initRoomScene({
      webglContainer: webglRef.current,
      css3dContainer: css3dRef.current,
      portfolioUrl: '/portfolio.html',
      reducedMotion: reduced,
      onState: (s) => {
        if (!cancelled) setSceneState(s)
      },
      onHover: (h) => {
        if (!cancelled) setHovering(h)
      },
      onTooltip: (name, x, y) => {
        if (!cancelled) {
          if (name && x !== undefined && y !== undefined) {
            setTooltip({ name, x, y })
          } else {
            setTooltip(null)
          }
        }
      },
      onReady: () => {
        const elapsed = performance.now() - t0
        const wait = Math.max(0, minBootMs - elapsed)
        window.setTimeout(() => {
          if (!cancelled) {
            setBooting(false)
            // start the intro NOW so the 3.6s timer begins when the user
            // first sees the scene (not during scene init)
            sceneRef.current?.startIntro()
          }
        }, wait)
      },
    })
      .then((s) => {
        if (cancelled) {
          s.dispose()
          return
        }
        sceneRef.current = s
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setLoadError(err?.message || 'Failed to load 3D scene')
      })

    return () => {
      cancelled = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [a11yMode, reduced])

  const handleSkipIntro = useCallback(() => {
    sceneRef.current?.skipIntro()
  }, [])

  const handleStepBack = useCallback(() => {
    sceneRef.current?.stepBack()
  }, [])

  const enterA11y = useCallback(() => {
    sceneRef.current?.dispose()
    sceneRef.current = null
    setA11yMode(true)
    setBooting(false)
  }, [])

  const exitA11y = useCallback(() => {
    setA11yMode(false)
    setBooting(true)
    setSceneState('loading')
  }, [])

  const showSkip = sceneState === 'intro' && !booting
  const seated = sceneState === 'seated'

  // hide the OS cursor when seated — lets the portfolio's custom cursor
  // (#c-dot / #c-cross) take over, reinforcing "you're inside the laptop"
  useEffect(() => {
    if (seated && !a11yMode) {
      document.body.style.cursor = 'none'
    } else {
      document.body.style.cursor = ''
    }
    return () => {
      document.body.style.cursor = ''
    }
  }, [seated, a11yMode])

  // keyboard shortcuts: Esc = step back (when seated), S = skip intro
  useEffect(() => {
    if (a11yMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sceneState === 'seated') {
        sceneRef.current?.stepBack()
      } else if ((e.key === 's' || e.key === 'S') && sceneState === 'intro') {
        sceneRef.current?.skipIntro()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [a11yMode, sceneState])

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#07060a] text-neutral-100">
      {/* 3D layers */}
      {!a11yMode && (
        <>
          <div ref={webglRef} className="absolute inset-0" />
          <div ref={css3dRef} className="absolute inset-0" style={{ pointerEvents: 'none' }} />
        </>
      )}

      {/* Accessibility: plain DOM portfolio iframe */}
      {a11yMode && (
        <iframe
          src="/portfolio.html"
          title="Portfolio (accessible)"
          className="absolute inset-0 h-full w-full border-0 bg-[#0a0a0c]"
        />
      )}

      {/* Cinematic intro title card — letterbox bars + branded title that
          fades in during the intro and dissolves as the camera settles.
          Clicking the title card during intro skips to idle. */}
      {!a11yMode && (sceneState === 'intro' || sceneState === 'idle') && !booting && (
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            opacity: sceneState === 'intro' ? 1 : 0,
            zIndex: 45,
            pointerEvents: sceneState === 'intro' ? 'auto' : 'none',
            cursor: sceneState === 'intro' ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (sceneState === 'intro') sceneRef.current?.skipIntro()
          }}
        >
          {/* letterbox bars */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '12vh', background: '#000' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '12vh', background: '#000' }} />
          {/* title text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center" style={{
              padding: '2rem 3rem',
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 80%)',
            }}>
              <p style={{
                fontSize: '12px',
                letterSpacing: '0.6em',
                textTransform: 'uppercase',
                color: '#f0a868',
                fontFamily: 'monospace',
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                margin: 0,
                animation: 'intro-fade-up 1.6s ease-out 0.3s both',
              }}>AKSHITH SURYA</p>
              <h1 style={{
                fontSize: 'clamp(1.8rem, 5vw, 3.6rem)',
                fontWeight: 300,
                letterSpacing: '0.05em',
                color: '#ffffff',
                margin: '0.5rem 0',
                textShadow: '0 4px 24px rgba(0,0,0,0.95), 0 0 60px rgba(0,0,0,0.8)',
                animation: 'intro-fade-up 1.6s ease-out 0.5s both',
              }}>Space Science & Hardware</h1>
              <div style={{
                width: '48px',
                height: '1px',
                background: '#f0a868',
                margin: '1rem auto',
                animation: 'intro-divider-grow 1s ease-out 0.9s both',
              }} />
              <p style={{
                fontSize: '12px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'monospace',
                textShadow: '0 2px 12px rgba(0,0,0,0.9)',
                margin: 0,
                animation: 'intro-fade-up 1.6s ease-out 1.1s both',
              }}>Space Science Student & Hardware Builder</p>
              <p style={{
                fontSize: '10px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'rgba(240, 168, 104, 0.6)',
                fontFamily: 'monospace',
                marginTop: '2rem',
                animation: 'intro-fade-up 1.6s ease-out 1.5s both',
              }}>click to skip</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating interactable object tooltip */}
      {tooltip && !a11yMode && sceneState === 'idle' && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2.5 rounded-lg border border-purple-500/40 bg-[#090314]/90 px-4 py-2 font-mono text-xs text-purple-100 shadow-[0_0_24px_rgba(168,85,247,0.35)] backdrop-blur-md transition-all duration-75"
          style={{
            left: Math.min(typeof window !== 'undefined' ? window.innerWidth - 320 : 800, Math.max(16, tooltip.x + 16)),
            top: Math.min(typeof window !== 'undefined' ? window.innerHeight - 60 : 600, Math.max(16, tooltip.y + 16)),
          }}
        >
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <span className="tracking-wider">{tooltip.name}</span>
        </div>
      )}

      {/* Boot / loading screen */}
      {booting && !a11yMode && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#07060a]">
          <div className="boot-grain absolute inset-0 opacity-[0.07]" />
          <div className="relative flex flex-col items-center gap-6">
            <div className="boot-logo relative">
              <div className="boot-ring" />
              <div className="boot-core" />
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.5em] text-amber-300/70">Entering the room</p>
              <p className="mt-2 font-mono text-[10px] tracking-widest text-neutral-500">
                {loadError ? loadError : 'warming up the desk lamp…'}
              </p>
            </div>
            <div className="boot-bar">
              <div className="boot-bar-fill" />
            </div>
          </div>
        </div>
      )}

      {/* Top-right controls */}
      {!a11yMode && (
        <div className="pointer-events-none absolute right-4 top-4 z-40 flex items-center gap-3 sm:right-6 sm:top-6">
          {showSkip && (
            <button
              onClick={handleSkipIntro}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-neutral-300 backdrop-blur-md transition hover:border-amber-300/50 hover:text-amber-200"
            >
              Skip intro
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tracking-normal text-neutral-500">S</kbd>
            </button>
          )}
          <button
            onClick={enterA11y}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/30 text-neutral-300 backdrop-blur-md transition hover:border-amber-300/50 hover:text-amber-200"
            title="Accessible text mode"
            aria-label="Switch to accessible text mode"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </button>
        </div>
      )}

      {a11yMode && (
        <button
          onClick={exitA11y}
          className="absolute right-4 top-4 z-40 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-neutral-300 backdrop-blur-md transition hover:border-amber-300/50 hover:text-amber-200 sm:right-6 sm:top-6"
        >
          ← Back to room
        </button>
      )}

      {/* Hover hint */}
      {!a11yMode && sceneState === 'idle' && (
        <div
          className={`pointer-events-none absolute left-1/2 top-[58%] z-30 -translate-x-1/2 text-center transition-opacity duration-300 ${hovering ? 'opacity-0' : 'opacity-100'
            }`}
        >
          <p className="text-xs uppercase tracking-[0.4em] text-amber-200/60">click the laptop</p>
          <div className="mx-auto mt-2 h-6 w-px bg-gradient-to-b from-amber-200/50 to-transparent" />
        </div>
      )}

      {/* Hovering indicator */}
      {!a11yMode && hovering && sceneState === 'idle' && (
        <div className="pointer-events-none absolute left-1/2 top-[42%] z-30 -translate-x-1/2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300">view portfolio →</p>
        </div>
      )}

      {/* Step-back affordance when seated */}
      {!a11yMode && seated && (
        <button
          onClick={handleStepBack}
          className="group absolute bottom-5 left-5 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.25em] text-neutral-400 opacity-60 backdrop-blur-md transition hover:opacity-100 hover:border-amber-300/40 hover:text-amber-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Step back
          <kbd className="ml-1 hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tracking-normal text-neutral-500 sm:inline">Esc</kbd>
        </button>
      )}

      {/* Sitting transition veil */}
      {!a11yMode && sceneState === 'sitting' && (
        <div className="pointer-events-none absolute inset-0 z-20 bg-black/30" />
      )}

      {/* Hidden status for screen readers */}
      <p className="sr-only" aria-live="polite">
        {a11yMode
          ? 'Accessible portfolio view.'
          : sceneState === 'seated'
            ? 'You are now seated at the laptop. The portfolio is open and operable. Press Escape to step back.'
            : sceneState === 'idle'
              ? 'You are standing in a 3D room. Click the laptop to view the portfolio, or use the accessible mode button.'
              : sceneState === 'intro'
                ? 'Cinematic intro playing. Click to skip, or wait for the room to settle.'
                : 'Loading 3D room.'}
      </p>

      <style jsx global>{`
        html,
        body {
          background: #07060a;
          margin: 0;
        }
        .boot-grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .boot-logo {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .boot-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px solid rgba(240, 168, 104, 0.35);
          border-top-color: rgba(240, 168, 104, 0.9);
          animation: spin 1.1s linear infinite;
        }
        .boot-core {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #f0a868;
          box-shadow: 0 0 24px 6px rgba(240, 168, 104, 0.55);
          animation: pulse 1.6s ease-in-out infinite;
        }
        .boot-bar {
          width: 220px;
          height: 2px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
          overflow: hidden;
        }
        .boot-bar-fill {
          height: 100%;
          width: 40%;
          background: linear-gradient(90deg, transparent, #f0a868, transparent);
          animation: sweep 1.3s ease-in-out infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.25);
            opacity: 1;
          }
        }
        @keyframes sweep {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(320%);
          }
        }
        /* Cinematic intro title card */
        .intro-letterbox {
          position: absolute;
          left: 0;
          right: 0;
          height: 12vh;
          background: #000;
          animation: letterbox-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .intro-letterbox-top {
          top: 0;
        }
        .intro-letterbox-bottom {
          bottom: 0;
        }
        @keyframes letterbox-in {
          from {
            height: 50vh;
          }
          to {
            height: 12vh;
          }
        }
        .intro-eyebrow {
          font-size: 12px;
          letter-spacing: 0.6em;
          text-transform: uppercase;
          color: #f0a868;
          font-family: monospace;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
          animation: intro-fade-up 1.6s ease-out 0.3s both;
        }
        .intro-title {
          font-size: clamp(2rem, 6vw, 4rem);
          font-weight: 200;
          letter-spacing: 0.05em;
          color: #ffffff;
          margin: 0.5rem 0;
          text-shadow: 0 4px 24px rgba(0, 0, 0, 0.95);
          animation: intro-fade-up 1.6s ease-out 0.5s both;
        }
        .intro-divider {
          width: 48px;
          height: 1px;
          background: #f0a868;
          margin: 1rem auto;
          animation: intro-divider-grow 1s ease-out 0.9s both;
        }
        @keyframes intro-divider-grow {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 48px;
            opacity: 1;
          }
        }
        .intro-subtitle {
          font-size: 13px;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.8);
          font-family: monospace;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
          animation: intro-fade-up 1.6s ease-out 1.1s both;
        }
        @keyframes intro-fade-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  )
}

// @ts-nocheck
/**
 * 3D Room Intro -> Laptop Portal
 * Three.js r128 (loaded from CDN as global THREE).
 * Builds a procedural PBR evening room, cinematic camera timeline,
 * raycast-to-laptop -> sit-down -> CSS3D iframe portal for portfolio.html.
 */

declare global {
  interface Window {
    THREE: any
  }
}

const CDN = 'https://unpkg.com/three@0.128.0'
const ADDONS = [
  'build/three.min.js',
  'examples/js/shaders/CopyShader.js',
  'examples/js/shaders/LuminosityHighPassShader.js',
  'examples/js/shaders/FXAAShader.js',
  'examples/js/postprocessing/Pass.js',
  'examples/js/postprocessing/MaskPass.js',
  'examples/js/postprocessing/ShaderPass.js',
  'examples/js/postprocessing/RenderPass.js',
  'examples/js/postprocessing/UnrealBloomPass.js',
  'examples/js/postprocessing/EffectComposer.js',
  'examples/js/renderers/CSS3DRenderer.js',
  'examples/js/objects/Reflector.js',
  'examples/js/shaders/BokehShader.js',
  'examples/js/postprocessing/BokehPass.js',
]

// module-level in-flight tracker so concurrent init calls share one load
const _loadPromises: Record<string, Promise<void>> = {}

function loadScript(src: string): Promise<void> {
  if (_loadPromises[src]) return _loadPromises[src]
  _loadPromises[src] = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load ' + src)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = false
    s.dataset.src = src
    s.onload = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    s.onerror = () => reject(new Error('Failed to load ' + src))
    document.head.appendChild(s)
  })
  return _loadPromises[src]
}

async function ensureTHREE(): Promise<any> {
  if (window.THREE && window.THREE.EffectComposer && window.THREE.CSS3DRenderer && window.THREE.Reflector && window.THREE.BokehPass) {
    return window.THREE
  }
  for (const a of ADDONS) {
    await loadScript(`${CDN}/${a}`)
  }
  // some addons attach asynchronously right after onload; verify with a short poll
  const deadline = performance.now() + 2000
  while (performance.now() < deadline) {
    if (window.THREE && window.THREE.EffectComposer && window.THREE.CSS3DRenderer && window.THREE.Reflector && window.THREE.BokehPass) break
    await new Promise((r) => setTimeout(r, 20))
  }
  if (!window.THREE || !window.THREE.CSS3DRenderer) {
    throw new Error('Three.js or addons failed to initialize')
  }
  return window.THREE
}

// ---------- math helpers ----------
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smoothstep = (t: number) => t * t * (3 - 2 * t)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// ---------- procedural canvas textures ----------
function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, alpha = 1) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    d[i] = clamp(d[i] + n, 0, 255)
    d[i + 1] = clamp(d[i + 1] + n, 0, 255)
    d[i + 2] = clamp(d[i + 2] + n, 0, 255)
    d[i + 3] = Math.min(255, d[i + 3] * alpha)
  }
  ctx.putImageData(img, 0, 0)
}

function woodTexture(opts: { base: string; grain: string; dark: string; w?: number; h?: number; vertical?: boolean }) {
  const { base, grain, dark, w = 2048, h = 2048, vertical = false } = opts
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Planking lines & subtle tone shifts between planks
  const plankCount = 8
  const plankSize = (vertical ? w : h) / plankCount
  for (let p = 0; p < plankCount; p++) {
    const pos = p * plankSize
    // plank subtle color variation
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'
    if (vertical) ctx.fillRect(pos, 0, plankSize, h)
    else ctx.fillRect(0, pos, w, plankSize)

    // plank seam gap
    ctx.fillStyle = 'rgba(10,5,2,0.6)'
    if (vertical) ctx.fillRect(pos, 0, 2, h)
    else ctx.fillRect(0, pos, w, 2)
  }

  // Layer 1: Broad organic rings / fibers
  const primaryRings = 180
  for (let i = 0; i < primaryRings; i++) {
    const pos = Math.random() * (vertical ? w : h)
    const thick = 0.8 + Math.random() * 3.5
    ctx.strokeStyle = Math.random() > 0.45 ? grain : dark
    ctx.globalAlpha = 0.12 + Math.random() * 0.38
    ctx.lineWidth = thick
    ctx.beginPath()
    const waveFreq = 0.008 + Math.random() * 0.015
    const waveAmp = 4 + Math.random() * 12
    if (vertical) {
      ctx.moveTo(pos, 0)
      for (let y = 0; y <= h; y += 8) {
        ctx.lineTo(pos + Math.sin(y * waveFreq + i * 0.5) * waveAmp + Math.cos(y * 0.03) * 2, y)
      }
    } else {
      ctx.moveTo(0, pos)
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, pos + Math.sin(x * waveFreq + i * 0.5) * waveAmp + Math.cos(x * 0.03) * 2)
      }
    }
    ctx.stroke()
  }

  // Layer 2: Ultra-fine wood pore capillaries
  ctx.globalAlpha = 0.2
  ctx.strokeStyle = dark
  ctx.lineWidth = 0.5
  for (let i = 0; i < 600; i++) {
    const rx = Math.random() * w
    const ry = Math.random() * h
    const len = 10 + Math.random() * 40
    ctx.beginPath()
    if (vertical) {
      ctx.moveTo(rx, ry)
      ctx.lineTo(rx + (Math.random() - 0.5) * 2, ry + len)
    } else {
      ctx.moveTo(rx, ry)
      ctx.lineTo(rx + len, ry + (Math.random() - 0.5) * 2)
    }
    ctx.stroke()
  }

  ctx.globalAlpha = 1.0
  // Realistic knots with wood grain swirl
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = 10 + Math.random() * 24

    // Knot center dark eye
    const g = ctx.createRadialGradient(x, y, 2, x, y, r)
    g.addColorStop(0, dark)
    g.addColorStop(0.4, grain)
    g.addColorStop(0.8, 'rgba(0,0,0,0.2)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // Swirl rings around knot
    for (let sr = r * 0.5; sr < r * 2.2; sr += 4) {
      ctx.strokeStyle = Math.random() > 0.5 ? dark : grain
      ctx.globalAlpha = 0.25
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.ellipse(x, y, sr, sr * 0.7, Math.PI * 0.25, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1.0
  noiseFill(ctx, w, h, 20)
  return c
}

function plasterTexture(opts: { base: string; w?: number; h?: number }) {
  const { base, w = 1536, h = 1536 } = opts
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Stippling and trowel micro-texture patches
  for (let i = 0; i < 45; i++) {
    const px = Math.random() * w
    const py = Math.random() * h
    const pr = 40 + Math.random() * 120
    const g = ctx.createRadialGradient(px, py, 5, px, py, pr)
    const isDark = Math.random() > 0.45
    g.addColorStop(0, isDark ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.03)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
  }

  // Trowel stroke directions
  ctx.strokeStyle = 'rgba(0,0,0,0.025)'
  ctx.lineWidth = 15
  for (let i = 0; i < 20; i++) {
    const sx = Math.random() * w
    const sy = Math.random() * h
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.quadraticCurveTo(sx + 100, sy + (Math.random() - 0.5) * 80, sx + 200, sy + (Math.random() - 0.5) * 40)
    ctx.stroke()
  }

  noiseFill(ctx, w, h, 26)
  return c
}

function metalTexture(opts: { base: string; w?: number; h?: number }) {
  const { base, w = 1024, h = 1024 } = opts
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // Brushed directional micro-lines
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const len = 4 + Math.random() * 28
    ctx.strokeStyle = Math.random() > 0.45 ? `rgba(255,255,255,${Math.random() * 0.08})` : `rgba(0,0,0,${Math.random() * 0.09})`
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y + (Math.random() - 0.5) * 0.5)
    ctx.stroke()
  }

  // Subtle anodized specular highlight variations
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, 'rgba(255,255,255,0.02)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.03)')
  g.addColorStop(1, 'rgba(255,255,255,0.02)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  noiseFill(ctx, w, h, 12)
  return c
}

function curtainFabricTexture(opts: { base: string; pattern: string; dark: string; w?: number; h?: number }): HTMLCanvasElement {
  const { base, pattern, dark, w = 1024, h = 1024 } = opts
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  // High-density organic fabric weave threads
  ctx.lineWidth = 1.0
  const step = 4
  for (let x = 0; x <= w; x += step) {
    ctx.strokeStyle = (x / step) % 2 === 0 ? pattern : dark
    ctx.globalAlpha = 0.15 + Math.random() * 0.15
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += step) {
    ctx.strokeStyle = (y / step) % 2 === 0 ? pattern : dark
    ctx.globalAlpha = 0.15 + Math.random() * 0.15
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1.0

  // Soft organic fabric slub variations (horizontal thick threads)
  for (let i = 0; i < 80; i++) {
    const sy = Math.random() * h
    const sx = Math.random() * (w * 0.7)
    const slen = 40 + Math.random() * 120
    ctx.strokeStyle = Math.random() > 0.5 ? pattern : dark
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + slen, sy)
    ctx.stroke()
  }
  ctx.globalAlpha = 1.0

  // Vertical curtain fold depth shading
  for (let x = 0; x < w; x += 128) {
    const g = ctx.createLinearGradient(x, 0, x + 128, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.32)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.06)')
    g.addColorStop(1, 'rgba(0,0,0,0.32)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, 128, h)
  }
  noiseFill(ctx, w, h, 24)
  return c
}

function roughnessFromCanvas(src: HTMLCanvasElement, base: number, variance: number): HTMLCanvasElement {
  const [c, ctx] = mkCanvas(src.width, src.height)
  ctx.drawImage(src, 0, 0)
  noiseFill(ctx, src.width, src.height, variance)
  // tint to grayscale-ish base
  const img = ctx.getImageData(0, 0, src.width, src.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3 / 255
    const v = clamp(base + lum * 0.35 - (Math.random() * 0.05), 0, 1) * 255
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Convert a source canvas (treated as a heightmap) into a tangent-space normal map
// via a Sobel filter. `strength` controls bump amplitude (0.5-4.0 typical).
function normalMapFromCanvas(src: HTMLCanvasElement, strength = 1.5): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const sCtx = src.getContext('2d')!
  const sData = sCtx.getImageData(0, 0, w, h).data
  const [out, oCtx] = mkCanvas(w, h)
  const outImg = oCtx.createImageData(w, h)
  const o = outImg.data
  // build a luminance height array 0..1
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = sData[i * 4], g = sData[i * 4 + 1], b = sData[i * 4 + 2]
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }
  const idx = (x: number, y: number) => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y
    return cy * w + cx
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = lum[idx(x - 1, y - 1)]
      const tc = lum[idx(x, y - 1)]
      const tr = lum[idx(x + 1, y - 1)]
      const cl = lum[idx(x - 1, y)]
      const cr = lum[idx(x + 1, y)]
      const bl = lum[idx(x - 1, y + 1)]
      const bc = lum[idx(x, y + 1)]
      const br = lum[idx(x + 1, y + 1)]
      // Sobel
      const dx = (tr + 2 * cr + br) - (tl + 2 * cl + bl)
      const dy = (bl + 2 * bc + br) - (tl + 2 * tc + tr)
      const nx = -dx * strength
      const ny = -dy * strength
      const nz = 1.0
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      const oI = (y * w + x) * 4
      o[oI] = (nx / len * 0.5 + 0.5) * 255
      o[oI + 1] = (ny / len * 0.5 + 0.5) * 255
      o[oI + 2] = (nz / len * 0.5 + 0.5) * 255
      o[oI + 3] = 255
    }
  }
  oCtx.putImageData(outImg, 0, 0)
  return out
}

function eveningSkyTexture(): HTMLCanvasElement {
  const w = 1024
  const h = 768
  const [c, ctx] = mkCanvas(w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#1a1530')
  g.addColorStop(0.45, '#3a2a44')
  g.addColorStop(0.7, '#7a4a4e')
  g.addColorStop(0.88, '#c87a52')
  g.addColorStop(1, '#e8a566')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // distant city silhouette
  ctx.fillStyle = 'rgba(10,8,16,0.85)'
  const baseY = h * 0.82
  let x = 0
  while (x < w) {
    const bw = 14 + Math.random() * 40
    const bh = 20 + Math.random() * 110
    ctx.fillRect(x, baseY - bh, bw, bh + 60)
    // windows
    ctx.fillStyle = 'rgba(255,180,90,0.5)'
    for (let wy = baseY - bh + 6; wy < baseY; wy += 8) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 7) {
        if (Math.random() > 0.55) ctx.fillRect(wx, wy, 2, 3)
      }
    }
    ctx.fillStyle = 'rgba(10,8,16,0.85)'
    x += bw + 2
  }
  // a moon
  ctx.fillStyle = 'rgba(255,240,210,0.85)'
  ctx.beginPath()
  ctx.arc(w * 0.74, h * 0.26, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,240,210,0.12)'
  ctx.beginPath()
  ctx.arc(w * 0.74, h * 0.26, 60, 0, Math.PI * 2)
  ctx.fill()
  noiseFill(ctx, w, h, 8)
  return c
}

function artTexture(artIdx = 0): HTMLCanvasElement {
  const w = 512
  const h = 640
  const [c, ctx] = mkCanvas(w, h)

  if (artIdx === 0) {
    // Cosmic Black Hole & Accretion Disk (Signature Portfolio Theme)
    ctx.fillStyle = '#080010'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 160; i++) {
      const sx = Math.random() * w
      const sy = Math.random() * h
      const sr = Math.random() * 1.5
      ctx.globalAlpha = 0.2 + Math.random() * 0.8
      ctx.fillRect(sx, sy, sr, sr)
    }
    ctx.globalAlpha = 1.0

    const cx = w / 2
    const cy = h / 2

    const gOut = ctx.createRadialGradient(cx, cy, 30, cx, cy, 230)
    gOut.addColorStop(0, 'rgba(255, 107, 53, 0.95)')
    gOut.addColorStop(0.35, 'rgba(168, 85, 247, 0.65)')
    gOut.addColorStop(0.7, 'rgba(0, 240, 255, 0.3)')
    gOut.addColorStop(1, 'rgba(8, 0, 16, 0)')
    ctx.fillStyle = gOut
    ctx.beginPath()
    ctx.arc(cx, cy, 230, 0, Math.PI * 2)
    ctx.fill()

    for (let r = 170; r >= 55; r -= 12) {
      ctx.beginPath()
      ctx.strokeStyle = r > 120 ? 'rgba(255, 107, 53, 0.65)' : r > 85 ? 'rgba(255, 179, 0, 0.85)' : 'rgba(0, 240, 255, 0.95)'
      ctx.lineWidth = 4 + Math.random() * 5
      ctx.ellipse(cx, cy, r, r * 0.45, -0.22, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.fillStyle = '#030006'
    ctx.beginPath()
    ctx.arc(cx, cy, 48, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, 49, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#f0eaff'
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ACCRETION DISK // BLACK HOLE', cx, h - 32)
  } else if (artIdx === 1) {
    // JWST Cosmic Nebula & Starfield
    ctx.fillStyle = '#04010d'
    ctx.fillRect(0, 0, w, h)

    for (let i = 0; i < 5; i++) {
      const gN = ctx.createRadialGradient(Math.random() * w, Math.random() * h, 10, w / 2, h / 2, 250)
      gN.addColorStop(0, i % 2 === 0 ? 'rgba(168, 85, 247, 0.7)' : 'rgba(0, 240, 255, 0.6)')
      gN.addColorStop(0.6, 'rgba(236, 72, 153, 0.3)')
      gN.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gN
      ctx.fillRect(0, 0, w, h)
    }

    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
    }
    ctx.fillStyle = '#00f0ff'
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('JWST CARINA NEBULA DEEP FIELD', w / 2, h - 32)
  } else {
    // Solar Flare & Plasma Loops
    const gPl = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 260)
    gPl.addColorStop(0, '#ffb300')
    gPl.addColorStop(0.35, '#ff3a1a')
    gPl.addColorStop(0.7, '#a855f7')
    gPl.addColorStop(1, '#0a0015')
    ctx.fillStyle = gPl
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = 'rgba(255, 220, 150, 0.8)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 110, 0, Math.PI * 1.6)
    ctx.stroke()

    ctx.fillStyle = '#ffb300'
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('SOLAR DYNAMICS OBSERVATORY', w / 2, h - 32)
  }

  noiseFill(ctx, w, h, 12)
  return c
}

function phoneScreenTexture(): HTMLCanvasElement {
  const w = 256
  const h = 512
  const [c, ctx] = mkCanvas(w, h)

  ctx.fillStyle = '#090314'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#a090b8'
  ctx.font = '16px monospace'
  ctx.fillText('17:58', 16, 30)
  ctx.fillText('SAT-TEL', 170, 30)

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(16, 44)
  ctx.lineTo(w - 16, 44)
  ctx.stroke()

  // Orbit Trajectory Arc
  ctx.strokeStyle = '#00f0ff'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(w / 2, 170, 75, 0.2, Math.PI - 0.2)
  ctx.stroke()

  ctx.fillStyle = '#ff6b35'
  ctx.beginPath()
  ctx.arc(w / 2 + 55, 140, 7, 0, Math.PI * 2)
  ctx.fill()

  // Chart Wave
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  let py = 320
  ctx.moveTo(20, py)
  for (let x = 20; x < w - 20; x += 20) {
    py = 320 + Math.sin(x * 0.1) * 35 + (Math.random() - 0.5) * 8
    ctx.lineTo(x, py)
  }
  ctx.stroke()

  ctx.fillStyle = '#00f0ff'
  ctx.font = 'bold 15px monospace'
  ctx.fillText('ALTITUDE: 408.2 KM', 24, 410)
  ctx.fillStyle = '#34d399'
  ctx.fillText('TELEMETRY: NOMINAL', 24, 440)

  noiseFill(ctx, w, h, 8)
  return c
}

function rugTexture(): HTMLCanvasElement {
  const w = 1024
  const h = 1024
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = '#3a2230'
  ctx.fillRect(0, 0, w, h)

  // Soft woven wool background weave
  for (let y = 0; y < h; y += 4) {
    ctx.strokeStyle = y % 8 === 0 ? '#4c2d3f' : '#2b1723'
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1.0

  ctx.strokeStyle = '#6a3a44'
  ctx.lineWidth = 12
  ctx.strokeRect(48, 48, w - 96, h - 96)
  ctx.strokeStyle = '#c8946a'
  ctx.lineWidth = 4
  ctx.strokeRect(80, 80, w - 160, h - 160)

  // Diamond pattern
  ctx.strokeStyle = 'rgba(200,148,106,0.6)'
  ctx.lineWidth = 3
  for (let y = 120; y < h - 120; y += 100) {
    for (let x = 120; x < w - 120; x += 100) {
      ctx.beginPath()
      ctx.moveTo(x, y - 36)
      ctx.lineTo(x + 36, y)
      ctx.lineTo(x, y + 36)
      ctx.lineTo(x - 36, y)
      ctx.closePath()
      ctx.stroke()
    }
  }

  // Woven wool fiber micro tufts
  for (let i = 0; i < 3000; i++) {
    const fx = Math.random() * w
    const fy = Math.random() * h
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(200,148,106,0.3)' : 'rgba(106,58,68,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.lineTo(fx + (Math.random() - 0.5) * 6, fy + (Math.random() - 0.5) * 6)
    ctx.stroke()
  }

  noiseFill(ctx, w, h, 28)
  return c
}

function steamSprite(): HTMLCanvasElement {
  const s = 128
  const [c, ctx] = mkCanvas(s, s)
  const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return c
}

function clockFaceTexture(): HTMLCanvasElement {
  const w = 512
  const h = 512
  const [c, ctx] = mkCanvas(w, h)
  const cx = w / 2
  const cy = h / 2
  const r = w / 2 - 14

  // Dial background - warm parchment cream gradient
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, r)
  g.addColorStop(0, '#f9f6ee')
  g.addColorStop(0.85, '#ede6d6')
  g.addColorStop(1, '#ddd4c2')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Outer ring tracks
  ctx.strokeStyle = '#2a241e'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, cy, r - 6, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, r - 26, 0, Math.PI * 2)
  ctx.stroke()

  // Minute & Hour Tick Marks (60 total)
  for (let i = 0; i < 60; i++) {
    const ang = (i / 60) * Math.PI * 2 - Math.PI / 2
    const isHour = i % 5 === 0
    const innerR = isHour ? r - 26 : r - 16
    const outerR = r - 6

    ctx.strokeStyle = isHour ? '#1a1612' : '#8a7d6e'
    ctx.lineWidth = isHour ? 4.5 : 1.8
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(ang) * innerR, cy + Math.sin(ang) * innerR)
    ctx.lineTo(cx + Math.cos(ang) * outerR, cy + Math.sin(ang) * outerR)
    ctx.stroke()
  }

  // Hour Numerals (1 - 12)
  ctx.fillStyle = '#1a1612'
  ctx.font = 'bold 36px "Inter", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const numR = r - 52
  for (let hNum = 1; hNum <= 12; hNum++) {
    const ang = (hNum / 12) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(ang) * numR
    const y = cy + Math.sin(ang) * numR
    ctx.fillText(hNum.toString(), x, y)
  }

  // Brand / Automatic text
  ctx.fillStyle = '#7a6d5c'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillText('CHRONO', cx, cy - 42)
  ctx.font = '10px sans-serif'
  ctx.fillText('AUTOMATIC', cx, cy + 42)

  noiseFill(ctx, w, h, 8)
  return c
}

// ---------- scene types ----------
export type SceneState = 'loading' | 'intro' | 'idle' | 'sitting' | 'seated' | 'standingup'

export interface RoomSceneOptions {
  webglContainer: HTMLElement
  css3dContainer: HTMLElement
  portfolioUrl: string
  onState: (s: SceneState) => void
  onHover: (h: boolean) => void
  onReady: () => void
  onTooltip?: (name: string | null, x?: number, y?: number) => void
  onMusicToggle?: (playing: boolean) => void
  reducedMotion?: boolean
}

export interface RoomScene {
  dispose: () => void
  skipIntro: () => void
  stepBack: () => void
  resize: () => void
  startIntro: () => void
  toggleMusic: () => void
}

// ---------- camera keyframes ----------
const CAM = {
  entryStart: { pos: [0.9, 1.72, 2.7], look: [-1.4, 0.95, -2.2] },
  entryEnd: { pos: [-0.15, 1.62, 0.45], look: [-1.4, 1.12, -2.3] },
  seated: { pos: [-1.4, 1.17, -1.42], look: [-1.4, 1.13, -2.32] },
}

const LAPTOP = {
  base: [-1.4, 0.752, -2.28],
  screen: [-1.4, 1.14, -2.34],
  screenW: 1.3,
  screenH: 0.81,
  tilt: -0.12,
}

export async function initRoomScene(opts: RoomSceneOptions): Promise<RoomScene> {
  const THREE = await ensureTHREE()
  const { webglContainer, css3dContainer, portfolioUrl } = opts
  const reduced = opts.reducedMotion ?? false

  // ----- renderers -----
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(webglContainer.clientWidth, webglContainer.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.display = 'block'
  webglContainer.appendChild(renderer.domElement)

  const cssRenderer = new THREE.CSS3DRenderer()
  cssRenderer.setSize(webglContainer.clientWidth, webglContainer.clientHeight)
  cssRenderer.domElement.style.position = 'absolute'
  cssRenderer.domElement.style.inset = '0'
  cssRenderer.domElement.style.pointerEvents = 'none'
  css3dContainer.appendChild(cssRenderer.domElement)

  // ----- scene + camera -----
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x07060a)
  scene.fog = new THREE.FogExp2(0x0a0810, 0.045)

  // procedural environment map for image-based lighting (PBR reflections on metal/glass)
  // high-contrast so metal picks up clear reflection streaks (window + lamp hotspots)
  const envCanvas = (() => {
    const w = 512
    const h = 256
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')!
    // base: dark room gradient (vertical)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#05040a')    // ceiling near-black
    g.addColorStop(0.45, '#1a1418') // upper wall
    g.addColorStop(0.7, '#2a1c14')  // mid wall warm
    g.addColorStop(1, '#0a0604')    // floor
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // bright window patch (right side, bright sunset)
    const wg = ctx.createRadialGradient(w * 0.8, h * 0.4, 4, w * 0.8, h * 0.4, w * 0.35)
    wg.addColorStop(0, 'rgba(255,210,150,1)')
    wg.addColorStop(0.3, 'rgba(240,170,90,0.8)')
    wg.addColorStop(0.6, 'rgba(180,110,60,0.3)')
    wg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = wg
    ctx.fillRect(0, 0, w, h)
    // warm lamp hotspot (left-center)
    const lg = ctx.createRadialGradient(w * 0.25, h * 0.5, 2, w * 0.25, h * 0.5, w * 0.18)
    lg.addColorStop(0, 'rgba(255,200,120,1)')
    lg.addColorStop(0.5, 'rgba(220,150,80,0.5)')
    lg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lg
    ctx.fillRect(0, 0, w, h)
    // ceiling bounce (subtle top glow)
    const cg = ctx.createLinearGradient(0, 0, 0, h * 0.3)
    cg.addColorStop(0, 'rgba(80,60,50,0.4)')
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg
    ctx.fillRect(0, 0, w, h * 0.3)
    return c
  })()
  const envTex = new THREE.CanvasTexture(envCanvas)
  envTex.mapping = THREE.EquirectangularReflectionMapping
  envTex.encoding = THREE.sRGBEncoding
  // r128: an equirectangular texture assigned to scene.environment drives PBR IBL
  scene.environment = envTex as any

  const camera = new THREE.PerspectiveCamera(
    50,
    webglContainer.clientWidth / webglContainer.clientHeight,
    0.05,
    100
  )
  camera.position.set(...(CAM.entryStart.pos as [number, number, number]))
  camera.lookAt(new THREE.Vector3(...(CAM.entryStart.look as [number, number, number])))

  const cssScene = new THREE.Scene()

  // ----- textures -----
  const texOpts = (map: HTMLCanvasElement, repeat?: [number, number], srgb = true) => {
    const t = new THREE.CanvasTexture(map)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (repeat) t.repeat.set(repeat[0], repeat[1])
    t.anisotropy = renderer.capabilities.getMaxAnisotropy()
    if (srgb) t.encoding = THREE.sRGBEncoding
    return t
  }

  const floorCanvas = woodTexture({ base: '#3a261a', grain: '#241609', dark: '#140b05' })
  const floorRough = roughnessFromCanvas(floorCanvas, 0.65, 26)
  const floorNormal = normalMapFromCanvas(floorCanvas, 3.0)
  const floorMat = new THREE.MeshStandardMaterial({
    map: texOpts(floorCanvas, [3, 3]),
    roughnessMap: texOpts(floorRough, [3, 3], false),
    normalMap: texOpts(floorNormal, [3, 3], false),
    normalScale: new THREE.Vector2(2.0, 2.0),
    roughness: 1,
    metalness: 0.0,
  })

  const wallCanvas = plasterTexture({ base: '#cdbfae' })
  const wallRough = roughnessFromCanvas(wallCanvas, 0.92, 10)
  const wallNormal = normalMapFromCanvas(wallCanvas, 1.0)
  const wallMat = new THREE.MeshStandardMaterial({
    map: texOpts(wallCanvas, [2, 1]),
    roughnessMap: texOpts(wallRough, [2, 1], false),
    normalMap: texOpts(wallNormal, [2, 1], false),
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 1,
    metalness: 0,
  })
  const wallWarmMat = wallMat.clone()
  wallWarmMat.color = new THREE.Color(0xb8a690)

  const ceilCanvas = plasterTexture({ base: '#b9ad9c' })
  const ceilNormal = normalMapFromCanvas(ceilCanvas, 0.5)
  const ceilMat = new THREE.MeshStandardMaterial({
    map: texOpts(ceilCanvas, [2, 2]),
    normalMap: texOpts(ceilNormal, [2, 2], false),
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 1,
    metalness: 0,
  })

  const deskCanvas = woodTexture({ base: '#5a3a22', grain: '#3a2410', dark: '#1c1006' })
  const deskRough = roughnessFromCanvas(deskCanvas, 0.5, 22)
  const deskNormal = normalMapFromCanvas(deskCanvas, 3.5)
  const deskMat = new THREE.MeshStandardMaterial({
    map: texOpts(deskCanvas),
    roughnessMap: texOpts(deskRough, undefined, false),
    normalMap: texOpts(deskNormal, undefined, false),
    normalScale: new THREE.Vector2(2.5, 2.5),
    roughness: 1,
    metalness: 0.0,
  })

  const metalCanvas = metalTexture({ base: '#3a3c40' })
  const metalRough = roughnessFromCanvas(metalCanvas, 0.42, 16)
  const metalNormal = normalMapFromCanvas(metalCanvas, 0.8)
  const laptopBodyMat = new THREE.MeshStandardMaterial({
    map: texOpts(metalCanvas),
    roughnessMap: texOpts(metalRough, undefined, false),
    normalMap: texOpts(metalNormal, undefined, false),
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0xc9ccd0,
    metalness: 0.92,
    roughness: 0.42,
    envMapIntensity: 1.0,
  })
  const laptopBaseMat = new THREE.MeshStandardMaterial({
    color: 0xb8bcc0,
    metalness: 0.9,
    roughness: 0.5,
  })

  // screen material (off-state: glossy black glass with faint standby glow + env reflection)
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x05060a,
    emissive: 0x05070d,
    emissiveIntensity: 0.0,
    roughness: 0.08,
    metalness: 0.0,
    envMapIntensity: 0.6,
    side: THREE.DoubleSide,
  })

  const curtainCanvas = curtainFabricTexture({ base: '#2b2326', pattern: '#44383d', dark: '#181315' })
  const curtainRough = roughnessFromCanvas(curtainCanvas, 0.9, 20)
  const curtainNormal = normalMapFromCanvas(curtainCanvas, 2.2)
  const curtainMat = new THREE.MeshStandardMaterial({
    map: texOpts(curtainCanvas, [1, 2]),
    roughnessMap: texOpts(curtainRough, [1, 2], false),
    normalMap: texOpts(curtainNormal, [1, 2], false),
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
  })

  const rugCanvas = rugTexture()
  const rugRough = roughnessFromCanvas(rugCanvas, 0.95, 25)
  const rugNormal = normalMapFromCanvas(rugCanvas, 2.5)
  const rugMat = new THREE.MeshStandardMaterial({
    map: texOpts(rugCanvas),
    roughnessMap: texOpts(rugRough, undefined, false),
    normalMap: texOpts(rugNormal, undefined, false),
    normalScale: new THREE.Vector2(1.8, 1.8),
    roughness: 0.96,
    metalness: 0,
  })

  const baseFabricCanvas = curtainFabricTexture({ base: '#3a2d2d', pattern: '#503f3f', dark: '#201818', w: 512, h: 512 })
  const baseFabricRough = roughnessFromCanvas(baseFabricCanvas, 0.88, 18)
  const baseFabricNormal = normalMapFromCanvas(baseFabricCanvas, 1.8)
  const fabricMat = new THREE.MeshStandardMaterial({
    map: texOpts(baseFabricCanvas),
    roughnessMap: texOpts(baseFabricRough, undefined, false),
    normalMap: texOpts(baseFabricNormal, undefined, false),
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.92,
    metalness: 0,
  })

  const ceramicDark = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.35, metalness: 0.15 })
  const plantPotMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.75, metalness: 0 })
  const bookMats = [0x8a3a3a, 0x3a5a8a, 0x6a6a3a, 0x5a3a6a, 0x3a6a5a, 0x8a6a3a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0 })
  )

  // ----- room architecture -----
  const ROOM = { w: 7, d: 6, h: 3.2 }
  const group = new THREE.Group()
  scene.add(group)

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  group.add(floor)

  // ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = ROOM.h
  group.add(ceil)

  // back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallWarmMat)
  backWall.position.set(0, ROOM.h / 2, -ROOM.d / 2)
  backWall.receiveShadow = true
  group.add(backWall)
  // left wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallMat)
  leftWall.position.set(-ROOM.w / 2, ROOM.h / 2, 0)
  leftWall.rotation.y = Math.PI / 2
  leftWall.receiveShadow = true
  group.add(leftWall)
  // right wall (with window)
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallMat)
  rightWall.position.set(ROOM.w / 2, ROOM.h / 2, 0)
  rightWall.rotation.y = -Math.PI / 2
  rightWall.receiveShadow = true
  group.add(rightWall)
  // front wall (behind camera at entry) - partial, low
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallMat)
  frontWall.position.set(0, ROOM.h / 2, ROOM.d / 2)
  frontWall.rotation.y = Math.PI
  group.add(frontWall)

  // baseboards
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.8, metalness: 0 })
  const addBaseboard = (w: number, x: number, z: number, ry: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.04), baseMat)
    b.position.set(x, 0.06, z)
    b.rotation.y = ry
    group.add(b)
  }
  addBaseboard(ROOM.w, 0, -ROOM.d / 2 + 0.02, 0)
  addBaseboard(ROOM.d, -ROOM.w / 2 + 0.02, 0, Math.PI / 2)
  addBaseboard(ROOM.d, ROOM.w / 2 - 0.02, 0, Math.PI / 2)

  // ----- window (back wall, right of desk) with evening sky -----
  const winX = 1.35
  const winY = 1.85
  const winZ = -ROOM.d / 2 + 0.03
  const winW = 1.8
  const winH = 1.55
  const skyTex = texOpts(eveningSkyTexture(), undefined, true)
  const skyMat = new THREE.MeshStandardMaterial({ map: skyTex, toneMapped: false, roughness: 0.9, emissive: 0x000000, emissiveIntensity: 0.0 })
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), skyMat)
  skyPlane.position.set(winX, winY, winZ + 0.02)
  group.add(skyPlane)
  // window frame (on back wall plane, depth along z)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1c18, roughness: 0.7, metalness: 0.2 })
  const frameDepth = 0.1
  const fT = (w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), frameMat)
    m.position.set(x, y, z)
    group.add(m)
    return m
  }
  fT(winW + 0.14, 0.07, winX, winY + winH / 2, winZ)
  fT(winW + 0.14, 0.07, winX, winY - winH / 2, winZ)
  fT(0.07, winH + 0.14, winX - winW / 2, winY, winZ)
  fT(0.07, winH + 0.14, winX + winW / 2, winY, winZ)
  fT(0.05, winH, winX, winY, winZ) // vertical mullion
  fT(winW, 0.05, winX, winY, winZ) // horizontal mullion
  // window sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.06, 0.18), frameMat)
  sill.position.set(winX, winY - winH / 2 - 0.05, winZ + 0.05)
  group.add(sill)
  // curtain rod + 3D wavy fabric curtains (mounted on back wall above window)
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, winW + 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 })
  )
  rod.rotation.z = Math.PI / 2
  rod.position.set(winX, winY + winH / 2 + 0.18, winZ + 0.06)
  group.add(rod)



  const makeCurtainGeo = (w: number, h: number) => {
    const geo = new THREE.PlaneGeometry(w, h, 32, 32)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const u = x / w + 0.5
      // 3D vertical folds / waves
      const wave = Math.sin(u * Math.PI * 7) * 0.04 + Math.cos(u * Math.PI * 14) * 0.015
      // subtle tie-back taper near middle height
      const normY = y / h
      const taper = 1.0 - Math.pow(Math.sin((normY + 0.5) * Math.PI), 2) * 0.12
      pos.setX(i, x * taper)
      pos.setZ(i, wave)
    }
    geo.computeVertexNormals()
    return geo
  }

  const curtainGeoL = makeCurtainGeo(0.55, winH + 0.5)
  const curtainL = new THREE.Mesh(curtainGeoL, curtainMat)
  curtainL.position.set(winX - winW / 2 - 0.12, winY + 0.05, winZ + 0.12)
  curtainL.rotation.z = 0.04
  curtainL.castShadow = true
  curtainL.receiveShadow = true
  group.add(curtainL)

  const curtainGeoR = makeCurtainGeo(0.55, winH + 0.5)
  const curtainR = new THREE.Mesh(curtainGeoR, curtainMat)
  curtainR.position.set(winX + winW / 2 + 0.12, winY + 0.05, winZ + 0.12)
  curtainR.rotation.z = -0.04
  curtainR.castShadow = true
  curtainR.receiveShadow = true
  group.add(curtainR)

  // ----- desk -----
  const deskGroup = new THREE.Group()
  deskGroup.position.set(-1.4, 0, -2.3)
  group.add(deskGroup)
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.85), deskMat)
  deskTop.position.y = 0.74
  deskTop.castShadow = true
  deskTop.receiveShadow = true
  deskGroup.add(deskTop)
  // planar reflection layer on the desk top — a Reflector plane flush with the
  // desk surface, blended over the wood so the laptop/lamp/mug reflect in it.
  // Resolution gated by viewport: full on desktop, halved on tablet, disabled on phones.
  const isMobile = webglContainer.clientWidth < 640
  const reflW = isMobile ? 0 : (webglContainer.clientWidth < 1000 ? 256 : 512)
  let deskReflector: any = null
  if (reflW > 0) {
    deskReflector = new THREE.Reflector(
      new THREE.PlaneGeometry(2.15, 0.82),
      {
        clipBias: 0.003,
        textureWidth: reflW,
        textureHeight: Math.round(reflW / 2),
        color: 0x202020,
      }
    )
    deskReflector.rotation.x = -Math.PI / 2
    deskReflector.position.set(-1.4, 0.766, -2.3)
    // the Reflector's own material is MeshBasic-like; we lower its opacity so the
    // wood shows through and the reflection reads as a subtle glossy sheen.
    const reflMat = deskReflector.material as any
    reflMat.transparent = true
    reflMat.opacity = 0.35
    group.add(deskReflector)
  }
  // desk legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7, metalness: 0.1 })
  const legGeo = new THREE.BoxGeometry(0.07, 0.74, 0.07)
  const legPositions: [number, number][] = [
    [-1.02, -0.36],
    [1.02, -0.36],
    [-1.02, 0.36],
    [1.02, 0.36],
  ]
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat)
    leg.position.set(lx, 0.37, lz)
    leg.castShadow = true
    deskGroup.add(leg)
  })
  // desk pedestal cabinet unit (under desk top on the right side)
  const cabGroup = new THREE.Group()
  cabGroup.position.set(0.62, 0.355, 0.0)
  deskGroup.add(cabGroup)

  const cabW = 0.72
  const cabH = 0.67
  const cabD = 0.72
  const tThick = 0.03

  const cabOuterMat = deskMat
  const cabInnerMat = new THREE.MeshStandardMaterial({ color: 0x241609, roughness: 0.8, metalness: 0 })

  // Top & bottom plates
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(cabW, tThick, cabD), cabOuterMat)
  topPlate.position.y = cabH / 2 - tThick / 2
  topPlate.castShadow = true
  topPlate.receiveShadow = true
  cabGroup.add(topPlate)

  const botPlate = new THREE.Mesh(new THREE.BoxGeometry(cabW, tThick, cabD), cabOuterMat)
  botPlate.position.y = -cabH / 2 + tThick / 2
  botPlate.castShadow = true
  botPlate.receiveShadow = true
  cabGroup.add(botPlate)

  // Left & right side panels
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(tThick, cabH - tThick * 2, cabD), cabOuterMat)
  sideL.position.set(-cabW / 2 + tThick / 2, 0, 0)
  sideL.castShadow = true
  sideL.receiveShadow = true
  cabGroup.add(sideL)

  const sideR = new THREE.Mesh(new THREE.BoxGeometry(tThick, cabH - tThick * 2, cabD), cabOuterMat)
  sideR.position.set(cabW / 2 - tThick / 2, 0, 0)
  sideR.castShadow = true
  sideR.receiveShadow = true
  cabGroup.add(sideR)

  // Back panel
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(cabW - tThick * 2, cabH - tThick * 2, tThick), cabOuterMat)
  backPanel.position.set(0, 0, -cabD / 2 + tThick / 2)
  cabGroup.add(backPanel)

  // Internal shelf divider
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(cabW - tThick * 2, tThick, cabD - tThick), cabInnerMat)
  shelf.position.set(0, 0, 0)
  cabGroup.add(shelf)

  // Polished metal handle material
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xc8b088, metalness: 0.85, roughness: 0.25, envMapIntensity: 1.2 })

  // Two stacked drawers with front faces & metallic handles
  const dH = (cabH - tThick * 3) / 2 - 0.015
  const dW = cabW - tThick * 2 - 0.015

  const addDrawerUnit = (yPos: number) => {
    const dBox = new THREE.Mesh(new THREE.BoxGeometry(dW, dH, 0.025), cabOuterMat)
    dBox.position.set(0, yPos, cabD / 2 - 0.01)
    dBox.castShadow = true
    dBox.receiveShadow = true
    cabGroup.add(dBox)

    const hHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12), handleMat)
    hHandle.rotation.z = Math.PI / 2
    hHandle.position.set(0, yPos, cabD / 2 + 0.018)
    cabGroup.add(hHandle)
  }

  addDrawerUnit(cabH / 4 - 0.008)
  addDrawerUnit(-cabH / 4 + 0.008)

  // ----- laptop -----
  const laptopGroup = new THREE.Group()
  laptopGroup.position.set(LAPTOP.base[0], LAPTOP.base[1], LAPTOP.base[2])
  group.add(laptopGroup)
  // base (keyboard deck)
  const lapBase = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.025, 0.9), laptopBaseMat)
  lapBase.position.y = 0.012
  lapBase.castShadow = true
  lapBase.receiveShadow = true
  laptopGroup.add(lapBase)
  // keyboard area (slightly recessed darker)
  const kbPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.006, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.6, metalness: 0.3 })
  )
  kbPlate.position.set(0, 0.028, -0.08)
  laptopGroup.add(kbPlate)
  // trackpad
  const trackpad = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.004, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.4, metalness: 0.4 })
  )
  trackpad.position.set(0, 0.03, 0.28)
  laptopGroup.add(trackpad)
  // key grid (instanced-ish simple boxes) with subtle backlight glow
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.55, metalness: 0.2, emissive: 0x2a3a5a, emissiveIntensity: 0.18 })
  const keyGeo = new THREE.BoxGeometry(0.05, 0.012, 0.05)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 12; c++) {
      const k = new THREE.Mesh(keyGeo, keyMat)
      k.position.set(-0.5 + c * 0.092, 0.038, -0.28 + r * 0.09)
      laptopGroup.add(k)
    }
  }
  // keyboard backlight plate (faint cyan glow leaking between keys)
  const kbGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x3a5a8a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  kbGlow.rotation.x = -Math.PI / 2
  kbGlow.position.set(0, 0.026, -0.08)
  laptopGroup.add(kbGlow)
  // hinge
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.28, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.4 })
  )
  hinge.rotation.z = Math.PI / 2
  hinge.position.set(0, 0.03, -0.44)
  laptopGroup.add(hinge)
  // screen assembly (pivots at hinge)
  const screenPivot = new THREE.Group()
  screenPivot.position.set(0, 0.03, -0.44)
  laptopGroup.add(screenPivot)
  // screen back lid (metal)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.82, 0.018), laptopBodyMat)
  lid.position.set(0, 0.41, 0.012)
  lid.castShadow = true
  screenPivot.add(lid)
  // screen face (the live surface mesh) - separate so we can raycast + glow.
  // PlaneGeometry default normal is +z (toward user/camera). No flip needed.
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(LAPTOP.screenW, LAPTOP.screenH), screenMat)
  screenMesh.position.set(0, 0.41, 0.022)
  screenPivot.add(screenMesh)
  // screen-glass diagonal sheen — a visible glossy highlight that reads as glass (not void)
  const screenSheen = new THREE.Mesh(
    new THREE.PlaneGeometry(LAPTOP.screenW, LAPTOP.screenH),
    new THREE.MeshBasicMaterial({
      map: (() => {
        const [c, ctx] = mkCanvas(256, 256)
        const g = ctx.createLinearGradient(0, 0, 256, 256)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.3, 'rgba(255,240,210,0.0)')
        g.addColorStop(0.48, 'rgba(255,240,210,0.5)')
        g.addColorStop(0.55, 'rgba(255,240,210,0.35)')
        g.addColorStop(0.65, 'rgba(255,240,210,0.0)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 256, 256)
        return new THREE.CanvasTexture(c)
      })(),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  screenSheen.position.set(0, 0.41, 0.024)
  screenPivot.add(screenSheen)
  // scanline flicker overlay — a thin horizontal line that sweeps down + a
  // brightness flash when the screen "wakes up" (sells "monitor turning on").
  // Activated briefly during the sit-down transition's wake phase.
  const scanlineFlicker = new THREE.Mesh(
    new THREE.PlaneGeometry(LAPTOP.screenW, 0.02),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  scanlineFlicker.position.set(0, 0.41, 0.028)
  screenPivot.add(scanlineFlicker)
  // screen bezel
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.86, 0.004),
    new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.5, metalness: 0.3 })
  )
  bezel.position.set(0, 0.41, 0.0)
  screenPivot.add(bezel)
  // hover glow rim — a slightly larger plane in front of the screen, additive amber,
  // opacity driven by `hovering` in the animate loop (discoverability hint)
  const screenGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(LAPTOP.screenW + 0.14, LAPTOP.screenH + 0.14),
    new THREE.MeshBasicMaterial({ color: 0xf0a868, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  screenGlow.position.set(0, 0.41, 0.026)
  screenPivot.add(screenGlow)
  // webcam dot
  const cam = new THREE.Mesh(
    new THREE.CircleGeometry(0.008, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3 })
  )
  cam.position.set(0, 0.78, -0.0005)
  screenPivot.add(cam)
  // tilt the screen back
  screenPivot.rotation.x = LAPTOP.tilt
  // apple-ish logo on lid back (glowing) - on the outer back of the lid
  const logo = new THREE.Mesh(
    new THREE.CircleGeometry(0.05, 24),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xeedccc, emissiveIntensity: 0.0, roughness: 0.3 })
  )
  logo.position.set(0, 0.41, -0.001)
  logo.rotation.y = Math.PI
  screenPivot.add(logo)
  // standby LED on the front-center lip of the laptop base — slow breathing white dot
  const standbyLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xf8f8ff, transparent: true, opacity: 0.7 })
  )
  standbyLed.position.set(0, 0.02, 0.44)
  laptopGroup.add(standbyLed)
  // LED glow halo (additive, larger)
  const ledHalo = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 24),
    new THREE.MeshBasicMaterial({ color: 0xb0c8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  ledHalo.position.set(0, 0.022, 0.44)
  ledHalo.rotation.x = -Math.PI / 2
  laptopGroup.add(ledHalo)

  // compute world transform of screen mesh for CSS3D placement
  const screenWorld = new THREE.Object3D()
  scene.add(screenWorld)
  const syncScreenWorld = () => {
    screenMesh.updateMatrixWorld()
    screenWorld.position.setFromMatrixPosition(screenMesh.matrixWorld)
    screenWorld.quaternion.setFromRotationMatrix(screenMesh.matrixWorld)
  }
  syncScreenWorld()

  // ----- chair -----
  const chairGroup = new THREE.Group()
  chairGroup.position.set(-1.4, 0, -1.25)
  group.add(chairGroup)
  // seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), fabricMat)
  seat.position.y = 0.46
  seat.castShadow = true
  seat.receiveShadow = true
  chairGroup.add(seat)
  // backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), fabricMat)
  back.position.set(0, 0.74, -0.22)
  back.castShadow = true
  chairGroup.add(back)
  // post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.42, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.85, roughness: 0.35 })
  )
  post.position.y = 0.23
  chairGroup.add(post)
  // base (5-star)
  const chairBaseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.85, roughness: 0.4 })
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.05), chairBaseMat)
    arm.position.y = 0.03
    arm.rotation.y = (i / 5) * Math.PI * 2
    arm.position.x = Math.cos((i / 5) * Math.PI * 2) * 0.16
    arm.position.z = Math.sin((i / 5) * Math.PI * 2) * 0.16
    chairGroup.add(arm)
    const wheel = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
    )
    wheel.position.set(Math.cos((i / 5) * Math.PI * 2) * 0.32, 0.03, Math.sin((i / 5) * Math.PI * 2) * 0.32)
    chairGroup.add(wheel)
  }

  // ----- desk lamp: weighted base + articulated arm + conical shade + glass bulb -----
  // Realistic architect-style lamp with proper joints, lit shade interior, and power cord.
  const lampGroup = new THREE.Group()
  lampGroup.position.set(-0.55, 0.765, -2.32)
  lampGroup.rotation.y = 0.25 // angle slightly toward the laptop
  group.add(lampGroup)

  const lampMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e1e22, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.1,
  })
  const lampJointMat = new THREE.MeshStandardMaterial({
    color: 0x0e0e10, metalness: 0.85, roughness: 0.5,
  })
  const lampRubberMat = new THREE.MeshStandardMaterial({
    color: 0x080808, roughness: 0.92, metalness: 0.0,
  })

  // --- weighted base: rubber pad + metal disc + bevel ring + switch ---
  const baseRubber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.108, 0.11, 0.006, 36), lampRubberMat
  )
  baseRubber.position.y = 0.003
  baseRubber.receiveShadow = true
  lampGroup.add(baseRubber)

  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.108, 0.026, 36), lampMetalMat
  )
  lampBase.position.y = 0.019
  lampBase.castShadow = true
  lampGroup.add(lampBase)

  // bevel ring on top of the base
  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.0045, 8, 28), lampJointMat
  )
  baseRing.position.y = 0.032
  baseRing.rotation.x = Math.PI / 2
  lampGroup.add(baseRing)

  // switch toggle (small angled cylinder on the base)
  const switchBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.006, 0.016, 10),
    new THREE.MeshStandardMaterial({ color: 0x6a2a1a, metalness: 0.5, roughness: 0.4 })
  )
  switchBtn.position.set(0.062, 0.045, 0)
  switchBtn.rotation.z = -0.35
  lampGroup.add(switchBtn)

  // pivot mount (where the lower arm attaches)
  const pivotBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 12), lampJointMat
  )
  pivotBase.position.y = 0.038
  lampGroup.add(pivotBase)

  // --- lower arm (vertical) ---
  const lowerArmLen = 0.2
  const lowerArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.011, lowerArmLen, 16), lampMetalMat
  )
  lowerArm.position.y = 0.038 + lowerArmLen / 2
  lowerArm.castShadow = true
  lampGroup.add(lowerArm)

  // --- elbow joint (sphere) ---
  const elbowY = 0.038 + lowerArmLen
  const elbow = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 18, 14), lampJointMat
  )
  elbow.position.y = elbowY
  elbow.castShadow = true
  lampGroup.add(elbow)

  // --- upper arm (angled to the LEFT toward the laptop/desk area) ---
  // rotation.z = +θ tilts the top of a Y-cylinder toward -X (left)
  const upperArmLen = 0.28
  const upperArmAngleZ = 1.0
  const upperArmDirX = -Math.sin(upperArmAngleZ)
  const upperArmDirY = Math.cos(upperArmAngleZ)
  const upperArmTipX = upperArmDirX * upperArmLen
  const upperArmTipY = elbowY + upperArmDirY * upperArmLen
  const upperArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.01, upperArmLen, 16), lampMetalMat
  )
  upperArm.position.set(upperArmDirX * upperArmLen / 2, elbowY + upperArmDirY * upperArmLen / 2, 0)
  upperArm.rotation.z = upperArmAngleZ
  upperArm.castShadow = true
  lampGroup.add(upperArm)

  // shade pivot joint at the tip
  const shadePivot = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 12), lampJointMat
  )
  shadePivot.position.set(upperArmTipX, upperArmTipY, 0)
  lampGroup.add(shadePivot)

  // --- shade group: positioned at the upper-arm tip, tilted to point down-left toward desk ---
  const shadeGroup = new THREE.Group()
  shadeGroup.position.set(upperArmTipX, upperArmTipY, 0)
  // negative z-rotation tilts the top toward +X, so the opening (bottom) faces -X (toward laptop)
  shadeGroup.rotation.z = -0.45
  lampGroup.add(shadeGroup)

  // shade geometry: truncated cone, open at the bottom
  const shadeLen = 0.17
  const shadeRTop = 0.05
  const shadeRBot = 0.115
  const shadeY = -shadeLen / 2 - 0.005 // hang below the pivot

  // outer shade (dark metal, double-sided so we see both surfaces)
  const shadeOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(shadeRTop, shadeRBot, shadeLen, 36, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x1c1a18, metalness: 0.78, roughness: 0.38, side: THREE.DoubleSide,
    })
  )
  shadeOuter.position.y = shadeY
  shadeOuter.castShadow = true
  shadeGroup.add(shadeOuter)

  // inner shade surface — warm, emissive, looks "lit from inside"
  const shadeInner = new THREE.Mesh(
    new THREE.CylinderGeometry(shadeRTop * 0.94, shadeRBot * 0.94, shadeLen * 0.94, 36, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x4a3220, emissive: 0xffb060, emissiveIntensity: 0.85,
      side: THREE.BackSide, roughness: 0.55, metalness: 0.15,
    })
  )
  shadeInner.position.y = shadeY
  shadeGroup.add(shadeInner)

  // shade rims (top + bottom) for a finished look
  const shadeRimMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.7, roughness: 0.45,
  })
  const topRim = new THREE.Mesh(new THREE.TorusGeometry(shadeRTop, 0.0035, 8, 28), shadeRimMat)
  topRim.position.y = shadeY + shadeLen / 2
  topRim.rotation.x = Math.PI / 2
  shadeGroup.add(topRim)
  const botRim = new THREE.Mesh(new THREE.TorusGeometry(shadeRBot, 0.0045, 8, 32), shadeRimMat)
  botRim.position.y = shadeY - shadeLen / 2
  botRim.rotation.x = Math.PI / 2
  shadeGroup.add(botRim)

  // bulb — emissive core (pokes slightly below the shade opening) + glass shell + filament + additive halos
  const bulbY = shadeY - shadeLen / 2 - 0.008 // just below the shade opening so the glow is visible from the side
  const bulbCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2d4 })
  )
  bulbCore.position.y = bulbY
  shadeGroup.add(bulbCore)

  // filament — a tiny vertical emissive line inside the bulb for "real bulb" detail
  const filament = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.022, 0.004),
    new THREE.MeshBasicMaterial({ color: 0xffeec0 })
  )
  filament.position.y = bulbY
  shadeGroup.add(filament)

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 22, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.32,
      roughness: 0.06, metalness: 0.0, envMapIntensity: 1.6,
    })
  )
  bulb.position.y = bulbY
  shadeGroup.add(bulb)

  // additive halo sprites around the bulb for a soft, prominent glow
  const bulbHaloMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(steamSprite()),
    color: 0xffd08a, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const bulbHalo = new THREE.Sprite(bulbHaloMat)
  bulbHalo.position.y = bulbY
  bulbHalo.scale.set(0.28, 0.28, 1)
  shadeGroup.add(bulbHalo)
  // a second, larger fainter halo for a wider glow read
  const bulbHalo2 = new THREE.Sprite(bulbHaloMat.clone())
  bulbHalo2.position.y = bulbY
  bulbHalo2.scale.set(0.5, 0.5, 1)
    ; (bulbHalo2.material as any).opacity = 0.35
  shadeGroup.add(bulbHalo2)

  // the actual point light — placed at the bulb, follows the shade
  const lampLight = new THREE.PointLight(0xffb066, 2.8, 9.0, 1.7)
  lampLight.position.set(0, bulbY, 0)
  lampLight.castShadow = true
  lampLight.shadow.mapSize.set(1024, 1024)
  lampLight.shadow.bias = -0.0008
  lampLight.shadow.radius = 4
  shadeGroup.add(lampLight)

  // power cord — TubeGeometry curve from base to the desk edge (back-right)
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, 0.006, 0.0),
    new THREE.Vector3(0.22, 0.004, 0.05),
    new THREE.Vector3(0.42, 0.002, 0.1),
    new THREE.Vector3(0.62, 0.001, 0.06),
    new THREE.Vector3(0.82, 0.0, 0.02),
  ])
  const cord = new THREE.Mesh(
    new THREE.TubeGeometry(cordCurve, 40, 0.005, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85, metalness: 0 })
  )
  cord.castShadow = true
  lampGroup.add(cord)

  // ----- mug: lathe-profiled ceramic with inner cavity, rim, handle, saucer -----
  // The mug now sits ON the desk (was sinking half-way through it before).
  const mugGroup = new THREE.Group()
  mugGroup.position.set(-2.3, 0.765, -2.45)
  mugGroup.rotation.y = -0.35 // slight natural angle
  group.add(mugGroup)

  // ceramic glaze texture — cream base with subtle vertical streaks + speckle
  const ceramicCanvas = (() => {
    const [c, ctx] = mkCanvas(256, 256)
    ctx.fillStyle = '#ece6d8'
    ctx.fillRect(0, 0, 256, 256)
    // faint vertical streaks (glaze running down during firing)
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 256
      const a = 0.025 + Math.random() * 0.035
      ctx.fillStyle = `rgba(170,158,140,${a})`
      ctx.fillRect(x, 0, 1 + Math.random() * 2, 256)
    }
    // soft speckle
    noiseFill(ctx, 256, 256, 7, 0.12)
    return c
  })()
  const ceramicNormal = normalMapFromCanvas(ceramicCanvas, 0.5)
  const mugMat = new THREE.MeshStandardMaterial({
    map: texOpts(ceramicCanvas),
    normalMap: texOpts(ceramicNormal, undefined, false),
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.16, // glossy ceramic glaze
    metalness: 0.0,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  })

  // LatheGeometry profile (right side, x = radius, y = height) — gives a real
  // mug silhouette with a foot, tapered body, thick rim, and inner cavity.
  const mugH = 0.115
  const mugRTop = 0.052
  const mugRBot = 0.045
  const mugWall = 0.0065
  const mugInnerTop = mugRTop - mugWall
  const mugInnerBot = mugRBot - mugWall
  const mugBaseThick = 0.011
  const mugProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(mugRBot * 0.82, 0.0),            // foot outer bottom
    new THREE.Vector2(mugRBot, 0.005),                 // foot curves up
    new THREE.Vector2(mugRBot, mugBaseThick),          // body start
    new THREE.Vector2(mugRTop * 0.98, mugH * 0.5),     // subtle taper mid-body
    new THREE.Vector2(mugRTop, mugH * 0.9),            // body to near top
    new THREE.Vector2(mugRTop, mugH),                  // outer top edge
    // rim — curves inward over the top
    new THREE.Vector2(mugRTop - 0.002, mugH + 0.0025),
    new THREE.Vector2(mugInnerTop, mugH),              // inner top edge
    // inner profile (top down to inner base)
    new THREE.Vector2(mugInnerTop, mugH * 0.9),
    new THREE.Vector2(mugInnerBot * 1.02, mugH * 0.5),
    new THREE.Vector2(mugInnerBot * 1.05, mugBaseThick + 0.002),
    new THREE.Vector2(0.0, mugBaseThick),              // inner base center
  ]
  const mug = new THREE.Mesh(new THREE.LatheGeometry(mugProfile, 48), mugMat)
  mug.castShadow = true
  mug.receiveShadow = true
  mugGroup.add(mug)

  // coffee surface — dark, glossy, sits just below the rim (inside the cavity)
  const coffeeY = mugH * 0.84
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(mugInnerTop * 0.96, 36),
    new THREE.MeshStandardMaterial({
      color: 0x1a0d05, roughness: 0.12, metalness: 0.0, envMapIntensity: 1.3,
    })
  )
  coffee.rotation.x = -Math.PI / 2
  coffee.position.y = coffeeY
  mugGroup.add(coffee)

  // handle — proper vertical torus attached at two points on the side
  const mugHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.038, 0.0085, 12, 28, Math.PI * 1.35),
    mugMat
  )
  mugHandle.position.set(mugRTop + 0.002, mugH * 0.5, 0)
  mugHandle.rotation.y = Math.PI / 2
  mugHandle.rotation.z = Math.PI * 0.5 - 0.675 // orient the arc opening to the right
  mugHandle.castShadow = true
  mugGroup.add(mugHandle)

  // saucer — ceramic, matching the mug's cream glaze (visible against the dark desk)
  const saucerProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.058, 0.0),
    new THREE.Vector2(0.092, 0.002),
    new THREE.Vector2(0.1, 0.006),   // outer lip
    new THREE.Vector2(0.1, 0.009),
    new THREE.Vector2(0.094, 0.011),
    new THREE.Vector2(0.058, 0.008),
    new THREE.Vector2(0.0, 0.006),
  ]
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerProfile, 48), mugMat)
  saucer.position.y = -0.002
  saucer.receiveShadow = true
  mugGroup.add(saucer)

  // steam particles — emit from the coffee surface, drift up
  const steamTex = new THREE.CanvasTexture(steamSprite())
  const steamMat = new THREE.PointsMaterial({
    map: steamTex,
    size: 0.13,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  const steamCount = 60
  const steamGeo = new THREE.BufferGeometry()
  const steamPos = new Float32Array(steamCount * 3)
  const steamSeed: number[] = []
  for (let i = 0; i < steamCount; i++) {
    steamPos[i * 3] = (Math.random() - 0.5) * 0.05
    steamPos[i * 3 + 1] = Math.random() * 0.4
    steamPos[i * 3 + 2] = (Math.random() - 0.5) * 0.05
    steamSeed.push(Math.random())
  }
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3))
  const steam = new THREE.Points(steamGeo, steamMat)
  // world-space position: mug base + coffee surface height (mug has no X/Z offset for the coffee)
  steam.position.set(-2.3, 0.765 + coffeeY, -2.45)
  scene.add(steam)

  // ----- mouse + mousepad (front-right of laptop) -----
  const padMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.85, metalness: 0 })
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), padMat)
  pad.rotation.x = -Math.PI / 2
  pad.position.set(-0.62, 0.767, -1.9)
  pad.receiveShadow = true
  group.add(pad)
  const mouse = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.4, metalness: 0.4 })
  )
  mouse.scale.set(1, 0.55, 1.6)
  mouse.position.set(-0.62, 0.767, -1.86)
  mouse.castShadow = true
  group.add(mouse)
  // cable laptop -> floor power strip (routed neatly along desk back leg)
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85, metalness: 0.1 })
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.4, 0.76, -2.65),
    new THREE.Vector3(-0.4, 0.74, -2.68),
    new THREE.Vector3(-0.35, 0.38, -2.7),
    new THREE.Vector3(-0.32, 0.04, -2.72),
  ])
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 32, 0.005, 8, false), cableMat)
  cable.castShadow = true
  group.add(cable)

  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.035, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5, metalness: 0.3 })
  )
  strip.position.set(-0.3, 0.018, -2.72)
  strip.castShadow = true
  group.add(strip)

  // ----- notebook + pen (right of laptop, behind mouse) -----
  const notebook = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.022, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.7 })
  )
  notebook.position.set(-0.55, 0.772, -2.05)
  notebook.rotation.y = -0.25
  notebook.castShadow = true
  group.add(notebook)
  const pen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 })
  )
  pen.rotation.z = Math.PI / 2.2
  pen.rotation.y = -0.25
  pen.position.set(-0.5, 0.786, -2.0)
  group.add(pen)

  // ----- potted plant (floor corner) — curved-leaf geometry, fuller, varied -----
  const plantGroup = new THREE.Group()
  plantGroup.position.set(-2.95, 0, -2.55)
  group.add(plantGroup)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 20), plantPotMat)
  pot.position.y = 0.15
  pot.castShadow = true
  pot.receiveShadow = true
  plantGroup.add(pot)
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 1 })
  )
  soil.position.y = 0.29
  plantGroup.add(soil)
  // leaf materials for variety (slight sheen for life)
  const leafMatA = new THREE.MeshStandardMaterial({ color: 0x2e5a32, roughness: 0.55, metalness: 0, side: THREE.DoubleSide })
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.5, metalness: 0, side: THREE.DoubleSide })
  const leafMatC = new THREE.MeshStandardMaterial({ color: 0x244a2a, roughness: 0.6, metalness: 0, side: THREE.DoubleSide })
  const leafMats = [leafMatA, leafMatB, leafMatC]

  // curved-leaf geometry builder: a blade that narrows to a tip and arches outward
  // built from a parametric strip with a central fold + outward curve + droop
  function makeLeafGeo(length: number, width: number, curve: number, droop: number) {
    const segs = 8
    const positions: number[] = []
    const indices: number[] = []
    const uvs: number[] = []
    for (let i = 0; i <= segs; i++) {
      const t = i / segs // 0 at base, 1 at tip
      const y = t * length
      // width tapers: full at base, narrow at tip
      const hw = width * (1 - t * 0.85) * 0.5
      // central fold lifts the midrib slightly
      const fold = Math.sin(t * Math.PI) * 0.012
      // outward curve (blade bends away from pot center, +x)
      const cx = curve * t * t
      // droop at the tip (sags down)
      const dy = -droop * Math.pow(t, 2.5)
      // two vertices per segment (left + right of midrib)
      positions.push(-hw + cx, y + dy, fold)
      positions.push(hw + cx, y + dy, fold)
      uvs.push(0, t)
      uvs.push(1, t)
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2)
      indices.push(a + 1, a + 3, a + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }

  // tall arching blades (snake-plant / spider-plant style)
  for (let i = 0; i < 18; i++) {
    const h = 0.5 + Math.random() * 0.4
    const w = 0.07 + Math.random() * 0.04
    const curve = (Math.random() - 0.5) * 0.18
    const droop = 0.04 + Math.random() * 0.08
    const leaf = new THREE.Mesh(makeLeafGeo(h, w, curve, droop), leafMats[i % 3])
    const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.3
    const r = 0.03 + Math.random() * 0.09
    leaf.position.set(Math.cos(ang) * r, 0.3, Math.sin(ang) * r)
    leaf.rotation.y = ang + Math.PI / 2
    leaf.rotation.z = (Math.random() - 0.5) * 0.4
    leaf.castShadow = true
    plantGroup.add(leaf)
  }
  // broader lower leaves (fullness at the base)
  for (let i = 0; i < 10; i++) {
    const h = 0.22 + Math.random() * 0.12
    const w = 0.11 + Math.random() * 0.04
    const curve = (Math.random() - 0.5) * 0.1
    const droop = 0.1 + Math.random() * 0.06
    const leaf = new THREE.Mesh(makeLeafGeo(h, w, curve, droop), leafMats[(i + 1) % 3])
    const ang = Math.random() * Math.PI * 2
    const r = 0.04 + Math.random() * 0.08
    leaf.position.set(Math.cos(ang) * r, 0.3, Math.sin(ang) * r)
    leaf.rotation.y = ang
    leaf.rotation.z = (Math.random() - 0.5) * 0.7
    leaf.castShadow = true
    plantGroup.add(leaf)
  }

  // ----- headphones resting on desk (left of laptop) -----
  const hpGroup = new THREE.Group()
  hpGroup.position.set(-2.18, 0.79, -2.15)
  hpGroup.rotation.set(0.15, -0.2, 0.08)
  group.add(hpGroup)
  const hpMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5, metalness: 0.3 })
  const hpCushMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.85, metalness: 0 })
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 10, 24, Math.PI), hpMat)
  band.rotation.x = Math.PI / 2
  band.position.y = 0
  hpGroup.add(band)
  const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 18), hpCushMat)
  earL.rotation.z = Math.PI / 2
  earL.position.set(-0.13, -0.02, 0)
  hpGroup.add(earL)
  const earR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 18), hpCushMat)
  earR.rotation.z = Math.PI / 2
  earR.position.set(0.13, -0.02, 0)
  hpGroup.add(earR)
  // cable trailing on desk
  const hpCable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.13, -0.01, 0),
        new THREE.Vector3(0.25, -0.01, 0.06),
        new THREE.Vector3(0.4, -0.01, 0.1),
        new THREE.Vector3(0.55, -0.01, 0.08),
      ]),
      16, 0.004, 6, false
    ),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
  )
  hpGroup.add(hpCable)

  // ----- phone leaning on a small cradle stand (left of laptop, resting on desk) -----
  const phoneGroup = new THREE.Group()
  phoneGroup.position.set(-2.0, 0.765, -2.05)
  phoneGroup.rotation.y = 0.3
  group.add(phoneGroup)
  // cradle: a small base + a back lip the phone leans against
  const standBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.012, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.8, roughness: 0.3 })
  )
  standBase.position.y = 0.006
  phoneGroup.add(standBase)
  const standLip = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.025, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.8, roughness: 0.3 })
  )
  standLip.position.set(0, 0.018, -0.02)
  phoneGroup.add(standLip)
  // phone leaning back at ~20deg, bottom edge touching the base front
  const phoneLean = 0.36
  const phoneH = 0.15
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, phoneH, 0.006),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.3, metalness: 0.5, emissive: 0x0a0a14, emissiveIntensity: 0.4 })
  )
  // place phone center so its bottom edge rests on the base top, leaning against the lip
  phone.position.set(0, 0.012 + (phoneH / 2) * Math.cos(phoneLean) + 0.004, 0.012 + (phoneH / 2) * Math.sin(phoneLean))
  phone.rotation.x = -phoneLean
  phoneGroup.add(phone)
  // phone screen glow (front face with satellite telemetry)
  const phoneScreenTex = texOpts(phoneScreenTexture(), undefined, true)
  const phoneScreenMat = new THREE.MeshBasicMaterial({ map: phoneScreenTex })
  const phoneScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.065, 0.13),
    phoneScreenMat
  )
  phoneScreen.position.copy(phone.position)
  phoneScreen.position.z += 0.004
  phoneScreen.rotation.copy(phone.rotation)
  phoneGroup.add(phoneScreen)

  // ----- Microcontroller Prototyping PCB Board (Space Hardware Builder Identity) -----
  const pcbGroup = new THREE.Group()
  pcbGroup.position.set(-2.2, 0.767, -2.55)
  pcbGroup.rotation.y = 0.2
  group.add(pcbGroup)

  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1d0f36, roughness: 0.3, metalness: 0.2 })
  const pcbBoard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.12), pcbMat)
  pcbBoard.position.y = 0.004
  pcbBoard.castShadow = true
  pcbGroup.add(pcbBoard)

  const traceMat = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.2, metalness: 0.9 })
  for (let i = 0; i < 4; i++) {
    const trace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.009, 0.004), traceMat)
    trace.position.set(0, 0.005, -0.04 + i * 0.025)
    pcbGroup.add(trace)
  }

  const chipMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.4, metalness: 0.8 })
  const pcbChip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.008, 0.048), chipMat)
  pcbChip.position.set(0, 0.008, 0)
  pcbGroup.add(pcbChip)

  const ledColors = [0x00f0ff, 0xa855f7, 0xffb300, 0x34d399]
  const pcbLeds: any[] = []
  ledColors.forEach((col, idx) => {
    const ledMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8, roughness: 0.2 })
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 12), ledMat)
    led.position.set(-0.06 + idx * 0.04, 0.009, 0.04)
    pcbGroup.add(led)
    pcbLeds.push(led)
  })

  // ----- sticky note on desk (discoverability hint + clutter) -----
  const stickyMat = new THREE.MeshStandardMaterial({ color: 0xf0d878, roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
  const sticky = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), stickyMat)
  sticky.rotation.x = -Math.PI / 2
  sticky.rotation.z = 0.4
  sticky.position.set(-0.95, 0.768, -2.05)
  group.add(sticky)
  // note: draw "click →" on the sticky via a tiny canvas texture overlay
  const stickyTextCanvas = (() => {
    const s = 128
    const [c, ctx] = mkCanvas(s, s)
    ctx.fillStyle = '#f0d878'
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1)
    ctx.fillStyle = '#3a2a10'
    ctx.font = 'bold 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('click', s / 2, s / 2 - 6)
    ctx.font = '26px sans-serif'
    ctx.fillText('the laptop', s / 2, s / 2 + 26)
    ctx.beginPath()
    ctx.moveTo(s / 2 - 10, s / 2 + 38)
    ctx.lineTo(s / 2 + 18, s / 2 + 48)
    ctx.lineTo(s / 2 + 8, s / 2 + 54)
    ctx.stroke()
    return c
  })()
  sticky.material = new THREE.MeshStandardMaterial({ map: texOpts(stickyTextCanvas, undefined, true), roughness: 0.85, side: THREE.DoubleSide })

  // ----- small stack of books on the desk (right of notebook) -----
  const deskBooksMat = [0x6a3a3a, 0x3a4a6a, 0x5a4a2a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 })
  )
  const deskBooksGroup = new THREE.Group()
  deskBooksGroup.position.set(-0.35, 0.767, -2.15)
  deskBooksGroup.rotation.y = -0.15
  group.add(deskBooksGroup)
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.16), deskBooksMat[i])
    b.position.y = 0.012 + i * 0.027
    b.rotation.y = (Math.random() - 0.5) * 0.08
    b.castShadow = true
    deskBooksGroup.add(b)
  }

  // ----- bookshelf (left wall) -----
  const shelfGroup = new THREE.Group()
  shelfGroup.position.set(-3.42, 0, 0.4)
  shelfGroup.rotation.y = Math.PI / 2
  group.add(shelfGroup)
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.75 })
  const shelfFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.32), shelfMat)
  shelfFrame.position.set(0, 1.0, 0)
  shelfFrame.castShadow = true
  shelfGroup.add(shelfFrame)
  // back panel cutout look: place shelves
  const shelfPlanks: number[] = [0.35, 0.9, 1.45, 1.9]
  shelfPlanks.forEach((sy) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.28), shelfMat)
    plank.position.set(0, sy, 0.02)
    shelfGroup.add(plank)
  })
  // books
  for (let s = 0; s < 3; s++) {
    let x = -0.5
    while (x < 0.5) {
      const bh = 0.18 + Math.random() * 0.14
      const bw = 0.03 + Math.random() * 0.04
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.2),
        bookMats[Math.floor(Math.random() * bookMats.length)]
      )
      book.position.set(x + bw / 2, shelfPlanks[s] + 0.015 + bh / 2, 0.02)
      book.castShadow = true
      shelfGroup.add(book)
      x += bw + 0.005
      if (Math.random() > 0.8) {
        // a tilted book
        const tb = book.clone()
        tb.rotation.z = (Math.random() - 0.5) * 0.3
        shelfGroup.add(tb)
        x += 0.02
      }
    }
  }

  // ----- wall art (left wall) -----
  const artFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.86, 0.68),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.6 })
  )
  artFrame.position.set(-3.44, 1.9, -0.9)
  group.add(artFrame)
  const artPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.74),
    new THREE.MeshStandardMaterial({ map: texOpts(artTexture(), undefined, true), roughness: 0.8, emissive: 0x221016, emissiveIntensity: 0.18 })
  )
  artPlane.position.set(-3.4, 1.9, -0.9)
  artPlane.rotation.y = Math.PI / 2
  group.add(artPlane)

  // ----- rug -----
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), new THREE.MeshStandardMaterial({ map: texOpts(rugTexture(), undefined, true), roughness: 0.95 }))
  rug.rotation.x = -Math.PI / 2
  rug.position.set(-1.4, 0.012, -1.5)
  rug.receiveShadow = true
  group.add(rug)

  // ----- contact shadows (fake AO) under furniture -----
  // soft radial-gradient discs that ground objects and kill the "floating" read
  const contactShadowTex = (() => {
    const s = 256
    const [c, ctx] = mkCanvas(s, s)
    const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(0.5, 'rgba(0,0,0,0.28)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    return new THREE.CanvasTexture(c)
  })()
  const addContact = (w: number, h: number, x: number, z: number, y = 0.013, opacity = 1) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, opacity, depthWrite: false })
    )
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    m.renderOrder = 1
    group.add(m)
  }
  addContact(2.6, 1.4, -1.4, -2.0, 0.014, 0.9)   // desk
  addContact(1.0, 1.0, -1.4, -1.25, 0.013, 0.85) // chair
  addContact(0.7, 0.7, -2.95, -2.55, 0.013, 0.8) // plant
  addContact(1.4, 0.5, -3.42, 0.4, 0.013, 0.7)   // bookshelf
  addContact(0.4, 0.4, -0.55, -2.32, 0.767, 0.6) // lamp on desk
  addContact(0.3, 0.3, -0.78, -1.92, 0.767, 0.5) // mug on desk
  addContact(0.35, 0.35, -1.4, -2.28, 0.767, 0.55) // laptop on desk

  // ----- volumetric god-ray from the window (additive soft cone) -----
  const godrayMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a8,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const godray = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), godrayMat)
  godray.position.set(0.55, 1.7, -1.6)
  godray.rotation.set(0, 0, 0.18)
  group.add(godray)
  // a second, narrower brighter ray
  const godray2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.0), godrayMat.clone())
    ; (godray2.material as any).opacity = 0.06
  godray2.position.set(0.9, 1.5, -0.6)
  godray2.rotation.set(0, 0, 0.32)
  group.add(godray2)

  // ----- drifting dust motes in the room (atmosphere) -----
  const dustTex = (() => {
    const s = 64
    const [c, ctx] = mkCanvas(s, s)
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,235,200,0.9)')
    g.addColorStop(0.4, 'rgba(255,235,200,0.3)')
    g.addColorStop(1, 'rgba(255,235,200,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    return new THREE.CanvasTexture(c)
  })()
  const dustCount = 120
  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(dustCount * 3)
  const dustVel: number[] = []
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -2 + Math.random() * 4
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 2.4
    dustPos[i * 3 + 2] = -2.5 + Math.random() * 2.5
    dustVel.push(0.02 + Math.random() * 0.04, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01)
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dustMat = new THREE.PointsMaterial({
    map: dustTex,
    size: 0.018,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const dust = new THREE.Points(dustGeo, dustMat)
  scene.add(dust)

  // ----- wall clock (centered on back wall above laptop desk) -----
  const clockGroup = new THREE.Group()
  clockGroup.position.set(-1.4, 2.28, -2.96)
  group.add(clockGroup)

  // Outer Frame (dark wood / metal bezel)
  const clockFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e1914, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.8
  })
  const clockFrame = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.04, 48),
    clockFrameMat
  )
  clockFrame.rotation.x = Math.PI / 2
  clockFrame.castShadow = true
  clockGroup.add(clockFrame)

  // Bevel brass inner trim ring
  const clockTrim = new THREE.Mesh(
    new THREE.TorusGeometry(0.218, 0.006, 12, 48),
    new THREE.MeshStandardMaterial({ color: 0xc89848, metalness: 0.85, roughness: 0.25 })
  )
  clockTrim.position.z = 0.021
  clockGroup.add(clockTrim)

  // Clock Face with crisp procedural canvas texture
  const clockTex = texOpts(clockFaceTexture(), undefined, true)
  const clockFaceMat = new THREE.MeshStandardMaterial({
    map: clockTex, roughness: 0.3, metalness: 0.0
  })
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.215, 48),
    clockFaceMat
  )
  clockFace.position.z = 0.022
  clockFace.receiveShadow = true
  clockGroup.add(clockFace)

  // Clock Glass Lens (protective reflective transparent sheen)
  const clockGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.5
    })
  )
  clockGlass.position.z = 0.028
  clockGroup.add(clockGlass)

  // Hands (hour, minute, second) with proper pivot offset
  const handMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.3, metalness: 0.6 })

  const hourGeo = new THREE.BoxGeometry(0.012, 0.09, 0.005)
  hourGeo.translate(0, 0.045, 0)
  const hourHand = new THREE.Mesh(hourGeo, handMat)
  hourHand.position.z = 0.024
  clockGroup.add(hourHand)

  const minGeo = new THREE.BoxGeometry(0.008, 0.13, 0.004)
  minGeo.translate(0, 0.065, 0)
  const minHand = new THREE.Mesh(minGeo, handMat)
  minHand.position.z = 0.025
  clockGroup.add(minHand)

  const secGeo = new THREE.BoxGeometry(0.003, 0.14, 0.003)
  secGeo.translate(0, 0.055, 0)
  const secHand = new THREE.Mesh(
    secGeo,
    new THREE.MeshStandardMaterial({ color: 0xd84028, roughness: 0.3, emissive: 0xd84028, emissiveIntensity: 0.2 })
  )
  secHand.position.z = 0.026
  clockGroup.add(secHand)

  // Center Cap Pin
  const centerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.008, 20),
    new THREE.MeshStandardMaterial({ color: 0xc89848, metalness: 0.9, roughness: 0.2 })
  )
  centerCap.rotation.x = Math.PI / 2
  centerCap.position.z = 0.027
  clockGroup.add(centerCap)

  // set initial rotation to current time
  const setClock = () => {
    const d = new Date()
    const s = d.getSeconds() + d.getMilliseconds() / 1000
    const m = d.getMinutes() + s / 60
    const h = (d.getHours() % 12) + m / 60
    hourHand.rotation.z = -h * (Math.PI / 6)
    minHand.rotation.z = -m * (Math.PI / 30)
    secHand.rotation.z = -s * (Math.PI / 30)
  }
  setClock()

  // ----- lights (rebalanced: warmer, lifted blacks, less mud) -----
  scene.add(new THREE.AmbientLight(0x8a7a6a, 0.45))
  // hemisphere fill (sky/ground bounce) — stronger to lift crushed blacks
  const hemi = new THREE.HemisphereLight(0x6a5a7a, 0x3a2a18, 0.85)
  scene.add(hemi)
  // key light from window (cool evening, coming through back wall window)
  const winLight = new THREE.DirectionalLight(0xc8c8e8, 0.85)
  winLight.position.set(1.35, 2.6, -4.5)
  winLight.target.position.set(-1, 1, -1.8)
  scene.add(winLight)
  scene.add(winLight.target)
  // rim/accent light behind desk to separate laptop silhouette (soft penumbra to avoid wall banding)
  const rim = new THREE.SpotLight(0xffc488, 1.3, 6, 0.6, 0.85, 1.2)
  rim.position.set(0.4, 2.4, -2.7)
  rim.target.position.set(-1.4, 1.1, -2.3)
  scene.add(rim)
  scene.add(rim.target)
  // warm bounce fill from the lamp side to lift shadowed faces
  const fill = new THREE.PointLight(0xffb88a, 0.55, 9, 2)
  fill.position.set(-0.4, 1.7, 1.0)
  scene.add(fill)
  // cool skylight bounce from the window side
  const skyBounce = new THREE.PointLight(0x8a9ad0, 0.4, 7, 2)
  skyBounce.position.set(1.2, 1.4, -1.8)
  scene.add(skyBounce)

  // ----- post-processing -----
  const composer = new THREE.EffectComposer(renderer)
  composer.addPass(new THREE.RenderPass(scene, camera))
  const bloom = new THREE.UnrealBloomPass(
    new THREE.Vector2(webglContainer.clientWidth, webglContainer.clientHeight),
    0.42, // strength (toned down — was washing out highlights)
    0.6, // radius
    0.78 // threshold (higher = only bright things bloom)
  )
  composer.addPass(bloom)
  // vignette shader
  const VignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      offset: { value: 1.12 },
      darkness: { value: 0.85 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float offset; uniform float darkness; varying vec2 vUv;
      void main(){ vec4 tex=texture2D(tDiffuse,vUv); vec2 uv=(vUv-0.5)*vec2(offset); gl_FragColor=vec4(mix(tex.rgb,tex.rgb*pow(dot(uv,uv),-darkness*0.4+0.6),1.0),tex.a);}`,
  }
  const vigPass = new THREE.ShaderPass(VignetteShader)
  composer.addPass(vigPass)
  // subtle chromatic aberration
  const CAShader = {
    uniforms: { tDiffuse: { value: null }, amount: { value: 0.0006 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
      void main(){ vec2 dir=vUv-0.5; float d=length(dir); vec2 offset=dir*amount*d*2.0;
      float r=texture2D(tDiffuse,vUv+offset).r; float g=texture2D(tDiffuse,vUv).g; float b=texture2D(tDiffuse,vUv-offset).b;
      gl_FragColor=vec4(r,g,b,1.0);}`,
  }
  const caPass = new THREE.ShaderPass(CAShader)
  composer.addPass(caPass)
  // depth-of-field (Bokeh) pass — used for rack-focus during the intro only.
  // `focus` is in world-space depth; `aperture` controls blur strength.
  // We animate focus from foreground (doorway ~1.5 units) to the desk (~3.2 units)
  // as the camera settles, with aperture easing down.
  const bokehPass = new THREE.BokehPass(scene, camera, {
    focus: 1.5,
    aperture: 0.018,
    maxblur: 0.04,
  })
  bokehPass.renderToScreen = false
  // start enabled (intro), disabled once idle/seated for perf
  bokehPass.enabled = true
  composer.addPass(bokehPass)
  composer.renderToScreen = true

  // ---------- interaction system ----------
  interface InteractableDef {
    name: string
    hitMeshes: any[]
    glowTargets: { mesh: any; color: number }[]
    onClick: () => void
  }

  // Per-object animation triggers & click timestamps
  let steamBurstTime = -10
  let hpClickTime = -10
  let mugClickTime = -10
  let lampClickTime = -10
  let mouseClickTime = -10
  let lampOn = true
  let phoneNotifTime = -10
  let notebookFlipTime = -10
  let plantRustleTime = -10
  let mouseLedOn = false
  let artGlowTime = -10
  let clockPulseTime = -10
  let pcbPulseTime = -10
  let booksShiftTime = -10
  let chairSwivelTime = -10
  let winGlowTime = -10
  let stickyLiftTime = -10
  let currentArtIdx = 0
  let activeInteractable: InteractableDef | null = null

  // Smooth damped spring physics helpers for ultra-fluid physical bounces
  function getSpring(elapsed: number, duration: number, bounces = 2.5, decay = 3.0): number {
    if (elapsed < 0 || elapsed >= duration) return 0
    const progress = elapsed / duration
    return Math.sin(progress * Math.PI * bounces) * Math.exp(-progress * decay) * Math.sin(progress * Math.PI)
  }
  function getEaseOutBounce(elapsed: number, duration: number): number {
    if (elapsed < 0 || elapsed >= duration) return 0
    const p = elapsed / duration
    return Math.sin(p * Math.PI)
  }

  // Store plant leaf original rotations for rustle animation
  plantGroup.children.forEach((c: any) => { c.userData._origRZ = c.rotation.z })

  function cycleArt() {
    artGlowTime = clock
    currentArtIdx = (currentArtIdx + 1) % 3
    const newArtCanvas = artTexture(currentArtIdx)
    artPlane.material.map = texOpts(newArtCanvas, undefined, true)
    artPlane.material.needsUpdate = true
  }

  function playSfx(type: string) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const ctx = audioCtx
      const now = ctx.currentTime

      if (type === 'headphones') {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(musicPlaying ? 400 : 800, now)
        osc.frequency.exponentialRampToValueAtTime(musicPlaying ? 150 : 1200, now + 0.08)
        g.gain.setValueAtTime(0.18, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(now); osc.stop(now + 0.09)
      } else if (type === 'coffee') {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(1400, now)
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12)
        g.gain.setValueAtTime(0.15, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(now); osc.stop(now + 0.13)

        const bSize = Math.floor(ctx.sampleRate * 0.22)
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1)
        const src = ctx.createBufferSource()
        src.buffer = buf
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1800
        filter.Q.value = 2.5
        const ng = ctx.createGain()
        ng.gain.setValueAtTime(0.06, now + 0.04)
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
        src.connect(filter); filter.connect(ng); ng.connect(ctx.destination)
        src.start(now + 0.04)
      } else if (type === 'lamp') {
        const o1 = ctx.createOscillator()
        const g1 = ctx.createGain()
        o1.type = 'square'
        o1.frequency.setValueAtTime(650, now)
        o1.frequency.exponentialRampToValueAtTime(150, now + 0.04)
        g1.gain.setValueAtTime(0.18, now)
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
        o1.connect(g1); g1.connect(ctx.destination)
        o1.start(now); o1.stop(now + 0.05)
      } else if (type === 'phone') {
        [880, 1760].forEach((freq, i) => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'sine'
          o.frequency.value = freq
          const t = now + i * 0.08
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(0.14, t + 0.01)
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
          o.connect(g); g.connect(ctx.destination)
          o.start(t); o.stop(t + 0.18)
        })
      } else if (type === 'notebook' || type === 'sticky') {
        const bSize = Math.floor(ctx.sampleRate * 0.12)
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1)
        const src = ctx.createBufferSource()
        src.buffer = buf
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1400
        filter.Q.value = 1.5
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.12, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
        src.connect(filter); filter.connect(g); g.connect(ctx.destination)
        src.start(now)
      } else if (type === 'plant') {
        const bSize = Math.floor(ctx.sampleRate * 0.2)
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1)
        const src = ctx.createBufferSource()
        src.buffer = buf
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 750
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.09, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
        src.connect(filter); filter.connect(g); g.connect(ctx.destination)
        src.start(now)
      } else if (type === 'mouse') {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'triangle'
        o.frequency.setValueAtTime(1200, now)
        o.frequency.exponentialRampToValueAtTime(300, now + 0.02)
        g.gain.setValueAtTime(0.18, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
        o.connect(g); g.connect(ctx.destination)
        o.start(now); o.stop(now + 0.03)
      } else if (type === 'art' || type === 'window') {
        [220, 330, 440, 660].forEach((freq) => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'sine'
          o.frequency.value = freq
          g.gain.setValueAtTime(0, now)
          g.gain.linearRampToValueAtTime(0.035, now + 0.3)
          g.gain.exponentialRampToValueAtTime(0.001, now + 1.1)
          o.connect(g); g.connect(ctx.destination)
          o.start(now); o.stop(now + 1.15)
        })
      } else if (type === 'clock') {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(1046.5, now)
        g.gain.setValueAtTime(0.18, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
        o.connect(g); g.connect(ctx.destination)
        o.start(now); o.stop(now + 0.48)
      } else if (type === 'pcb') {
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((freq, idx) => {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = 'square'
          o.frequency.value = freq
          const t = now + idx * 0.05
          g.gain.setValueAtTime(0.05, t)
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
          o.connect(g); g.connect(ctx.destination)
          o.start(t); o.stop(t + 0.07)
        })
      } else if (type === 'books') {
        const bSize = Math.floor(ctx.sampleRate * 0.15)
        const buf = ctx.createBuffer(1, bSize, ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1)
        const src = ctx.createBufferSource()
        src.buffer = buf
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 450
        filter.Q.value = 1.0
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.14, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        src.connect(filter); filter.connect(g); g.connect(ctx.destination)
        src.start(now)
      } else if (type === 'chair') {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(90, now)
        o.frequency.linearRampToValueAtTime(140, now + 0.4)
        o.frequency.linearRampToValueAtTime(80, now + 0.75)
        g.gain.setValueAtTime(0.07, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8)
        o.connect(g); g.connect(ctx.destination)
        o.start(now); o.stop(now + 0.82)
      }
    } catch { }
  }

  const interactables: InteractableDef[] = [
    {
      name: 'Studio Monitor Headphones — Click to toggle lofi beats',
      hitMeshes: [band, earL, earR],
      glowTargets: [
        { mesh: earL, color: 0xa855f7 },
        { mesh: earR, color: 0xa855f7 },
        { mesh: band, color: 0xa855f7 },
      ],
      onClick: () => {
        hpClickTime = clock
        playSfx('headphones')
        toggleMusic()
      },
    },
    {
      name: 'Hot Espresso Mug — Click to take a sip',
      hitMeshes: [mug, coffee, saucer],
      glowTargets: [{ mesh: mug, color: 0xffb300 }],
      onClick: () => {
        steamBurstTime = clock
        mugClickTime = clock
        playSfx('coffee')
      },
    },
    {
      name: 'Architect Desk Lamp — Click to toggle room light',
      hitMeshes: [lampBase, shadeOuter, lowerArm, upperArm, switchBtn],
      glowTargets: [{ mesh: shadeOuter, color: 0xffb060 }],
      onClick: () => {
        lampOn = !lampOn
        lampClickTime = clock
        playSfx('lamp')
      },
    },
    {
      name: 'Telemetry Smartphone — Click to check satellite updates',
      hitMeshes: [phone, phoneScreen, standBase],
      glowTargets: [{ mesh: phone, color: 0x00f0ff }],
      onClick: () => {
        phoneNotifTime = clock
        playSfx('phone')
      },
    },
    {
      name: 'Engineering Lab Journal — Click to inspect research notes',
      hitMeshes: [notebook, pen],
      glowTargets: [{ mesh: notebook, color: 0xffb300 }],
      onClick: () => {
        notebookFlipTime = clock
        playSfx('notebook')
      },
    },
    {
      name: 'Lush Houseplant — Click to rustle foliage',
      hitMeshes: [pot, soil, ...plantGroup.children.filter((c: any) => c !== pot && c !== soil)],
      glowTargets: [{ mesh: pot, color: 0x34d399 }],
      onClick: () => {
        plantRustleTime = clock
        playSfx('plant')
      },
    },
    {
      name: 'Precision Gaming Mouse — Click to toggle RGB lighting',
      hitMeshes: [mouse, pad],
      glowTargets: [{ mesh: mouse, color: 0x00f0ff }],
      onClick: () => {
        mouseLedOn = !mouseLedOn
        mouseClickTime = clock
        playSfx('mouse')
      },
    },
    {
      name: 'Cosmic Observatory Poster — Click to cycle space artwork',
      hitMeshes: [artPlane, artFrame],
      glowTargets: [{ mesh: artPlane, color: 0xa855f7 }],
      onClick: () => {
        cycleArt()
        playSfx('art')
      },
    },
    {
      name: 'Analog Wall Clock — Click to trigger clock chime',
      hitMeshes: [clockFace, clockFrame, clockGlass],
      glowTargets: [{ mesh: clockFace, color: 0xffb300 }],
      onClick: () => {
        clockPulseTime = clock
        playSfx('clock')
      },
    },
    {
      name: 'Microcontroller Prototype PCB — Click to run hardware diagnostics',
      hitMeshes: [pcbBoard, pcbChip, ...pcbLeds],
      glowTargets: [{ mesh: pcbBoard, color: 0xa855f7 }],
      onClick: () => {
        pcbPulseTime = clock
        playSfx('pcb')
      },
    },
    {
      name: 'Astrophysics Textbooks — Click to adjust book stack',
      hitMeshes: deskBooksGroup.children,
      glowTargets: [{ mesh: deskBooksGroup.children[0], color: 0x4d7cff }],
      onClick: () => {
        booksShiftTime = clock
        playSfx('books')
      },
    },
    {
      name: 'Ergonomic Office Chair — Click to swivel chair',
      hitMeshes: [seat, back],
      glowTargets: [{ mesh: seat, color: 0xa855f7 }],
      onClick: () => {
        chairSwivelTime = clock
        playSfx('chair')
      },
    },
    {
      name: 'Observatory Window — Click to adjust starlight glow',
      hitMeshes: [skyPlane],
      glowTargets: [{ mesh: skyPlane, color: 0x00f0ff }],
      onClick: () => {
        winGlowTime = clock
        playSfx('window')
      },
    },
    {
      name: 'Desk Memo Note — Click to inspect memo',
      hitMeshes: [sticky],
      glowTargets: [{ mesh: sticky, color: 0xffb300 }],
      onClick: () => {
        stickyLiftTime = clock
        playSfx('sticky')
      },
    },
  ]

  // Save original emissive states for restoration after hover
  const origEmissives = new Map<any, { color: number; intensity: number }>()
  interactables.forEach((ia) => {
    ia.glowTargets.forEach((gt) => {
      const mat = gt.mesh ? gt.mesh.material : null
      if (mat && mat.emissive) {
        origEmissives.set(gt.mesh, {
          color: mat.emissive.getHex(),
          intensity: (mat.emissive.getHex() !== 0) ? (mat.emissiveIntensity ?? 0) : 0,
        })
      } else if (mat) {
        origEmissives.set(gt.mesh, {
          color: 0,
          intensity: 0,
        })
      }
    })
  })

  // Flat mesh-to-interactable lookup for raycasting
  const allInteractMeshes: any[] = []
  const meshToIA = new Map<any, InteractableDef>()
  interactables.forEach((ia) => {
    ia.hitMeshes.forEach((m) => {
      allInteractMeshes.push(m)
      meshToIA.set(m, ia)
    })
  })

  // ---------- procedural lofi music (Web Audio API) ----------
  let audioCtx: AudioContext | null = null
  let musicPlaying = false
  let lofiCleanup: (() => void) | null = null

  function startLofiMusic() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const ctx = audioCtx!
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, ctx.currentTime)
    masterGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 1.5)
    masterGain.connect(ctx.destination)

    // Vinyl crackle
    const crackleLen = 4
    const crackleBuffer = ctx.createBuffer(1, ctx.sampleRate * crackleLen, ctx.sampleRate)
    const crackleData = crackleBuffer.getChannelData(0)
    for (let i = 0; i < crackleData.length; i++) {
      crackleData[i] = (Math.random() * 2 - 1) * (Math.random() > 0.985 ? 0.25 : 0.015)
    }
    const crackle = ctx.createBufferSource()
    crackle.buffer = crackleBuffer
    crackle.loop = true
    const crackleFilter = ctx.createBiquadFilter()
    crackleFilter.type = 'bandpass'
    crackleFilter.frequency.value = 2800
    crackleFilter.Q.value = 0.4
    const crackleGain = ctx.createGain()
    crackleGain.gain.value = 0.18
    crackle.connect(crackleFilter)
    crackleFilter.connect(crackleGain)
    crackleGain.connect(masterGain)
    crackle.start()

    const BPM = 72
    const beatDur = 60 / BPM
    const barDur = beatDur * 4
    const chords = [
      [146.83, 174.61, 220, 261.63, 329.63],
      [196, 246.94, 293.66, 349.23, 440],
      [130.81, 164.81, 196, 246.94, 311.13],
      [110, 130.81, 164.81, 196, 261.63],
    ]

    function noiseBuf(dur: number) {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      return buf
    }

    function playKick(time: number) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(150, time)
      o.frequency.exponentialRampToValueAtTime(35, time + 0.12)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.50, time)
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.28)
      o.connect(g); g.connect(masterGain)
      o.start(time); o.stop(time + 0.3)
    }

    function playHihat(time: number, loud: boolean) {
      const d = loud ? 0.06 : 0.035
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf(d)
      const f = ctx.createBiquadFilter()
      f.type = 'highpass'; f.frequency.value = 7500
      const g = ctx.createGain()
      g.gain.setValueAtTime(loud ? 0.12 : 0.05, time)
      g.gain.exponentialRampToValueAtTime(0.001, time + d)
      src.connect(f); f.connect(g); g.connect(masterGain)
      src.start(time)
    }

    function playSnare(time: number) {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuf(0.1)
      const f = ctx.createBiquadFilter()
      f.type = 'bandpass'; f.frequency.value = 2800
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.22, time)
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.12)
      src.connect(f); f.connect(g); g.connect(masterGain)
      src.start(time)
      const o = ctx.createOscillator()
      o.type = 'triangle'; o.frequency.value = 185
      const og = ctx.createGain()
      og.gain.setValueAtTime(0.18, time)
      og.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
      o.connect(og); og.connect(masterGain)
      o.start(time); o.stop(time + 0.12)
    }

    function playPad(freqs: number[], time: number, dur: number) {
      freqs.forEach((freq) => {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'; o.frequency.value = freq
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'; f.frequency.value = 600 + Math.random() * 200; f.Q.value = 0.8
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, time)
        g.gain.linearRampToValueAtTime(0.045, time + 0.15)
        g.gain.setValueAtTime(0.045, time + dur - 0.2)
        g.gain.linearRampToValueAtTime(0, time + dur)
        o.connect(f); f.connect(g); g.connect(masterGain)
        o.start(time); o.stop(time + dur + 0.1)
      })
    }

    function playBass(freq: number, time: number, dur: number) {
      const o = ctx.createOscillator()
      o.type = 'sine'; o.frequency.value = freq / 2
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, time)
      g.gain.linearRampToValueAtTime(0.25, time + 0.04)
      g.gain.setValueAtTime(0.25, time + dur * 0.7)
      g.gain.linearRampToValueAtTime(0, time + dur)
      o.connect(g); g.connect(masterGain)
      o.start(time); o.stop(time + dur + 0.1)
    }


    function scheduleBar(barIdx: number, t: number) {
      const ch = chords[barIdx % 4]
      playPad(ch, t, barDur)
      playBass(ch[0], t, beatDur * 2)
      playBass(ch[0] * 1.5, t + beatDur * 2, beatDur * 2)
      for (let b = 0; b < 4; b++) {
        const bt = t + b * beatDur
        if (b === 0 || b === 2) playKick(bt)
        if (b === 1 || b === 3) playSnare(bt)
        playHihat(bt, b % 2 === 0)
        playHihat(bt + beatDur * 0.5, false)
      }
    }

    let nextTime = ctx.currentTime + 0.15
    let barIndex = 0
    const ahead = 0.3
    let schedTimer: number | null = null
    function loopSchedule() {
      while (nextTime < ctx.currentTime + ahead) {
        scheduleBar(barIndex, nextTime)
        nextTime += barDur
        barIndex++
      }
      schedTimer = window.setTimeout(loopSchedule, 120) as unknown as number
    }
    loopSchedule()

    musicPlaying = true
    opts.onMusicToggle?.(true)

    lofiCleanup = () => {
      if (schedTimer !== null) clearTimeout(schedTimer)
      try { crackle.stop() } catch { }
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
      window.setTimeout(() => { try { masterGain.disconnect() } catch { } }, 600)
      musicPlaying = false
      opts.onMusicToggle?.(false)
    }
  }

  function stopLofiMusic() {
    if (lofiCleanup) { lofiCleanup(); lofiCleanup = null }
  }

  function toggleMusic() {
    if (musicPlaying) stopLofiMusic()
    else startLofiMusic()
  }

  // ---------- animation state machine ----------
  let state: SceneState = 'loading'
  let rafId = 0
  let last = performance.now()
  let clock = 0
  let transStart = 0
  let idleClock = 0
  let hovering = false
  let iframeObj: any = null
  let iframeEl: HTMLIFrameElement | null = null
  let webglActive = true
  let disposed = false

  const setLook = (pos: number[], look: number[]) => {
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(new THREE.Vector3(look[0], look[1], look[2]))
  }

  const setState = (s: SceneState) => {
    state = s
    opts.onState(s)
  }

  // ---------- iframe mount ----------
  const PIXELS_PER_UNIT = 1000
  function mountIframe() {
    if (iframeObj) return
    syncScreenWorld()
    const el = document.createElement('iframe')
    el.src = portfolioUrl
    el.style.width = LAPTOP.screenW * PIXELS_PER_UNIT + 'px'
    el.style.height = LAPTOP.screenH * PIXELS_PER_UNIT + 'px'
    el.style.border = '0'
    el.style.background = '#0a0a0c'
    el.style.pointerEvents = 'auto'
    el.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.04)'
    el.setAttribute('title', 'Portfolio')
    el.setAttribute('allow', 'fullscreen')
    iframeEl = el
    iframeObj = new THREE.CSS3DObject(el)
    iframeObj.position.copy(screenWorld.position)
    iframeObj.quaternion.copy(screenWorld.quaternion)
    iframeObj.scale.set(1 / PIXELS_PER_UNIT, 1 / PIXELS_PER_UNIT, 1 / PIXELS_PER_UNIT)
    cssScene.add(iframeObj)
  }
  function unmountIframe() {
    if (!iframeObj) return
    cssScene.remove(iframeObj)
    if (iframeEl && iframeEl.parentNode) iframeEl.parentNode.removeChild(iframeEl)
    iframeEl = null
    iframeObj = null
  }

  // ---------- camera tween helper ----------
  function tweenCamera(from: { pos: number[]; look: number[] }, to: { pos: number[]; look: number[] }, t: number, ease = easeInOutCubic) {
    const e = ease(t)
    const pos = [
      lerp(from.pos[0], to.pos[0], e),
      lerp(from.pos[1], to.pos[1], e),
      lerp(from.pos[2], to.pos[2], e),
    ]
    const look = [
      lerp(from.look[0], to.look[0], e),
      lerp(from.look[1], to.look[1], e),
      lerp(from.look[2], to.look[2], e),
    ]
    setLook(pos, look)
  }

  // ---------- interaction ----------
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  function onPointerMove(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    if (state !== 'idle') {
      if (activeInteractable) { activeInteractable = null; opts.onTooltip?.(null) }
      return
    }
    raycaster.setFromCamera(pointer, camera)
    // laptop screen has priority
    const laptopHit = raycaster.intersectObject(screenMesh, false)
    const h = laptopHit.length > 0
    if (h !== hovering) {
      hovering = h
      opts.onHover(h)
    }
    // check interactable objects
    let found: InteractableDef | null = null
    if (!h) {
      const hits = raycaster.intersectObjects(allInteractMeshes, false)
      if (hits.length > 0) found = meshToIA.get(hits[0].object) || null
    }
    if (found !== activeInteractable) {
      activeInteractable = found
      opts.onTooltip?.(found ? found.name : null, e.clientX, e.clientY)
    } else if (found) {
      opts.onTooltip?.(found.name, e.clientX, e.clientY)
    }
    renderer.domElement.style.cursor = (h || found) ? 'pointer' : 'default'
  }
  function onClick(e: MouseEvent) {
    if (state !== 'idle') return
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    // laptop click → sit down
    const laptopHit = raycaster.intersectObject(screenMesh, false)
    if (laptopHit.length > 0) { startSitDown(); return }
    // interactable click
    const hits = raycaster.intersectObjects(allInteractMeshes, false)
    if (hits.length > 0) {
      const ia = meshToIA.get(hits[0].object)
      if (ia) ia.onClick()
    }
  }
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('click', onClick)

  function startSitDown() {
    if (state !== 'idle') return
    setState('sitting')
    transStart = clock
    // capture start camera config
    sitFrom = {
      pos: [camera.position.x, camera.position.y, camera.position.z],
      look: [CAM.entryEnd.look[0], CAM.entryEnd.look[1], CAM.entryEnd.look[2]],
    }
    // re-aim current look target toward laptop for smoother path
    sitFrom.look = [LAPTOP.screen[0], LAPTOP.screen[1], LAPTOP.screen[2]]
  }
  let sitFrom = { pos: [...(CAM.entryEnd.pos as number[])], look: [...(CAM.entryEnd.look as number[])] }

  function startStandUp() {
    if (state !== 'seated') return
    setState('standingup')
    transStart = clock
    standFrom = {
      pos: [camera.position.x, camera.position.y, camera.position.z],
      look: [LAPTOP.screen[0], LAPTOP.screen[1], LAPTOP.screen[2]],
    }
    // dim screen + unmount iframe immediately to avoid pop
    unmountIframe()
    renderer.domElement.style.pointerEvents = 'auto'
    renderer.domElement.style.cursor = 'default'
  }
  let standFrom = { pos: [...(CAM.seated.pos as number[])], look: [...(LAPTOP.screen as number[])] }

  // ---------- main loop ----------
  // Tab visibility handling: pause RAF when the tab is hidden (saves CPU/battery).
  // On resume, reset `last` so we don't get a huge realDt that would skip animations.
  let tabVisible = true
  const onVisibilityChange = () => {
    if (document.hidden && tabVisible) {
      tabVisible = false
      cancelAnimationFrame(rafId)
    } else if (!document.hidden && !tabVisible) {
      tabVisible = true
      last = performance.now()
      rafId = requestAnimationFrame(animate)
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  function animate() {
    if (disposed) return
    if (!tabVisible) return
    rafId = requestAnimationFrame(animate)
    // Use performance.now() directly (not the RAF timestamp) to guarantee
    // monotonic timing — RAF timestamps can differ from performance.now() in
    // some environments, causing negative deltas and instant intro completion.
    const now = performance.now()
    const realDt = Math.max(0, (now - last) / 1000)
    const dt = Math.min(0.05, realDt)
    last = now
    clock += realDt
    idleClock += realDt

    // idle micro-motion
    const sway = Math.sin(idleClock * 0.5) * 0.012
    const sway2 = Math.cos(idleClock * 0.37) * 0.008

    // lamp toggle + flicker
    const lampTarget = lampOn ? 2.8 : 0.0
    const lampFlicker = lampOn ? Math.sin(idleClock * 11.0) * 0.05 + Math.sin(idleClock * 3.3) * 0.04 : 0
    lampLight.intensity = lerp(lampLight.intensity, lampTarget + lampFlicker, 0.08)
      ; (bulbCore.material as any).color.setRGB(lampOn ? 1 : 0.1, lampOn ? 0.95 : 0.08, lampOn ? 0.83 : 0.06)
      ; (bulbHaloMat as any).opacity = lerp((bulbHaloMat as any).opacity, lampOn ? 0.85 : 0, 0.08)
      ; (bulbHalo2.material as any).opacity = lerp((bulbHalo2.material as any).opacity, lampOn ? 0.35 : 0, 0.08)
      ; (shadeInner.material as any).emissiveIntensity = lerp((shadeInner.material as any).emissiveIntensity, lampOn ? 0.85 : 0, 0.08)
    // standby LED breathing (only when not seated — screen is "asleep")
    const ledOn = state !== 'seated'
    const ledPulse = ledOn ? 0.7 + Math.sin(idleClock * 1.2) * 0.25 : 0.0
      ; (standbyLed.material as any).opacity = lerp((standbyLed.material as any).opacity, ledPulse, 0.1)
      ; (ledHalo.material as any).opacity = lerp((ledHalo.material as any).opacity, ledPulse * 0.45, 0.1)
    standbyLed.visible = ledOn
    ledHalo.visible = ledOn

    // steam motion
    const sp = steamGeo.attributes.position as any
    for (let i = 0; i < steamCount; i++) {
      sp.array[i * 3 + 1] += dt * (0.06 + steamSeed[i] * 0.05)
      sp.array[i * 3] += Math.sin(idleClock * 1.5 + steamSeed[i] * 10) * 0.0015
      if (sp.array[i * 3 + 1] > 0.6) {
        sp.array[i * 3 + 1] = 0
        sp.array[i * 3] = (Math.random() - 0.5) * 0.06
        sp.array[i * 3 + 2] = (Math.random() - 0.5) * 0.06
      }
    }
    sp.needsUpdate = true
    if (clock - steamBurstTime > 2.5) steamMat.opacity = 0.18 + Math.sin(idleClock * 0.8) * 0.06

    // dust motes drifting in the light beams
    const dp = dustGeo.attributes.position as any
    for (let i = 0; i < dustCount; i++) {
      dp.array[i * 3] += dustVel[i * 3] * dt
      dp.array[i * 3 + 1] += Math.sin(idleClock * 0.5 + i) * 0.0008 + dustVel[i * 3 + 1] * dt
      dp.array[i * 3 + 2] += dustVel[i * 3 + 2] * dt
      if (dp.array[i * 3] > 2.2) dp.array[i * 3] = -2.2
      if (dp.array[i * 3] < -2.2) dp.array[i * 3] = 2.2
      if (dp.array[i * 3 + 1] > 2.8) dp.array[i * 3 + 1] = 0.2
      if (dp.array[i * 3 + 1] < 0.2) dp.array[i * 3 + 1] = 2.8
    }
    dp.needsUpdate = true
    dustMat.opacity = 0.4 + Math.sin(idleClock * 0.3) * 0.1

    // god-ray gentle shimmer
    godrayMat.opacity = 0.06 + Math.sin(idleClock * 0.6) * 0.012
      ; (godray2.material as any).opacity = 0.05 + Math.cos(idleClock * 0.45) * 0.012

    // real-time wall clock
    setClock()

    // hover glow rim on the laptop screen
    const targetGlow = hovering ? 0.5 + Math.sin(idleClock * 3) * 0.08 : 0.0
      ; (screenGlow.material as any).opacity = lerp((screenGlow.material as any).opacity, targetGlow, 0.12)

    // ---------- interactable hover glow ----------
    interactables.forEach((ia) => {
      const isActive = ia === activeInteractable
      ia.glowTargets.forEach((gt) => {
        const mat = gt.mesh ? gt.mesh.material : null
        const orig = origEmissives.get(gt.mesh)
        if (!mat || !orig) return
        if (musicPlaying && (gt.mesh === earL || gt.mesh === earR || gt.mesh === band)) return
        if (isActive) {
          const pulse = 0.45 + Math.sin(idleClock * 3.5) * 0.15
          if (mat.emissive) {
            mat.emissive.setHex(gt.color)
            mat.emissiveIntensity = lerp(mat.emissiveIntensity, pulse, 0.12)
          }
        } else {
          if (mat.emissive) {
            mat.emissive.setHex(orig.color)
            mat.emissiveIntensity = lerp(mat.emissiveIntensity, orig.intensity, 0.08)
          }
        }
      })
    })

    // Headphones music glow & bounce click animation
    if (musicPlaying) {
      const mP = 0.25 + Math.sin(idleClock * 2.5) * 0.15
      if ((earL.material as any)?.emissive) {
        ; (earL.material as any).emissive.setHex(0x7a4aff)
          ; (earL.material as any).emissiveIntensity = mP
      }
      if ((earR.material as any)?.emissive) {
        ; (earR.material as any).emissive.setHex(0x7a4aff)
          ; (earR.material as any).emissiveIntensity = mP
      }
      if ((band.material as any)?.emissive) {
        ; (band.material as any).emissive.setHex(0x5a3aaa)
          ; (band.material as any).emissiveIntensity = mP * 0.5
      }
    }
    const hpT = clock - hpClickTime
    if (hpT >= 0 && hpT < 1.0) {
      const s = getSpring(hpT, 1.0, 3, 2.5)
      hpGroup.scale.set(1 + s * 0.22, 1 - s * 0.18, 1 + s * 0.22)
      hpGroup.rotation.z = 0.08 + s * 0.15
    } else {
      hpGroup.scale.set(1, 1, 1)
      hpGroup.rotation.z = 0.08
    }

    // Espresso mug sip lift, squish bounce & steam burst
    const mgT = clock - mugClickTime
    if (mgT >= 0 && mgT < 1.2) {
      const s = getSpring(mgT, 1.2, 2.5, 2.5)
      const b = getEaseOutBounce(mgT, 1.2)
      mugGroup.position.y = 0.765 + b * 0.04 // mug rest y = 0.765
      mugGroup.rotation.z = -0.35 + s * 0.18
      mugGroup.scale.set(1 + s * 0.12, 1 - s * 0.08, 1 + s * 0.12)
    } else {
      mugGroup.position.y = 0.765
      mugGroup.rotation.z = -0.35
      mugGroup.scale.set(1, 1, 1)
    }
    const stBurst = clock - steamBurstTime
    if (stBurst >= 0 && stBurst < 2.5) {
      steamMat.opacity = 0.4 + (1 - stBurst / 2.5) * 0.55
    }

    // Desk lamp switch dip & arm spring recoil animation
    const lmT = clock - lampClickTime
    if (lmT >= 0 && lmT < 0.9) {
      const s = getSpring(lmT, 0.9, 3, 3)
      const b = getEaseOutBounce(lmT, 0.4)
      shadeGroup.rotation.z = -0.45 - s * 0.25
      switchBtn.position.y = 0.045 - b * 0.008
    } else {
      shadeGroup.rotation.z = -0.45
      switchBtn.position.y = 0.045
    }

    // Phone notification pop, vibration shake & screen flash
    const phNotif = clock - phoneNotifTime
    if (phNotif >= 0 && phNotif < 1.8) {
      const s = getSpring(phNotif, 1.2, 4, 3)
      const vib = phNotif < 0.6 ? Math.sin(phNotif * 60) * 0.006 * (1 - phNotif / 0.6) : 0
      phoneGroup.scale.setScalar(1 + s * 0.2)
      phoneGroup.position.x = -2.0 + vib
      const flash = Math.floor(phNotif * 8) % 2 === 0
      if ((phoneScreen.material as any)?.color) {
        ; (phoneScreen.material as any).color.setHex(flash ? 0x00f0ff : 0x1a2a3a)
      }
    } else {
      phoneGroup.scale.setScalar(1)
      phoneGroup.position.x = -2.0
      if ((phoneScreen.material as any)?.color) {
        ; (phoneScreen.material as any).color.setHex(0x1a2a3a)
      }
    }

    // Notebook 3D arc lift, cover flip & pen roll animation
    const nbFlip = clock - notebookFlipTime
    if (nbFlip >= 0 && nbFlip < 1.1) {
      const s = getSpring(nbFlip, 1.1, 2.5, 2.2)
      const b = getEaseOutBounce(nbFlip, 1.1)
      notebook.position.y = 0.772 + b * 0.045
      notebook.rotation.x = Math.sin((nbFlip / 1.1) * Math.PI) * 0.35
      notebook.scale.set(1 + s * 0.1, 1, 1 + s * 0.1)
      pen.position.x = -0.5 + s * 0.025
    } else {
      notebook.position.y = 0.772
      notebook.rotation.x = 0
      notebook.scale.set(1, 1, 1)
      pen.position.x = -0.5
    }

    // Houseplant pot spring recoil & leaf foliage rustle wave
    const plRust = clock - plantRustleTime
    if (plRust >= 0 && plRust < 2.5) {
      const fade = 1 - plRust / 2.5
      const s = getSpring(plRust, 1.5, 4, 2.5)
      pot.rotation.z = s * 0.08
      pot.scale.set(1 + s * 0.1, 1 - s * 0.08, 1 + s * 0.1)
      plantGroup.children.forEach((child: any, idx: number) => {
        if (idx > 2 && child.userData._origRZ !== undefined) {
          child.rotation.z = child.userData._origRZ + Math.sin(clock * 16 + idx * 1.7) * 0.06 * fade
        }
      })
    } else {
      pot.rotation.z = 0
      pot.scale.set(1, 1, 1)
      plantGroup.children.forEach((child: any, idx: number) => {
        if (idx > 2 && child.userData._origRZ !== undefined) {
          child.rotation.z = child.userData._origRZ
        }
      })
    }

    // Gaming mouse physical click press, squish scale & rainbow RGB spectrum
    const msT = clock - mouseClickTime
    if (msT >= 0 && msT < 0.8) {
      const s = getSpring(msT, 0.8, 3, 3)
      const b = getEaseOutBounce(msT, 0.3)
      mouse.position.y = 0.767 - b * 0.007
      mouse.rotation.x = -b * 0.08
      mouse.scale.set(1 + s * 0.12, 0.55 - b * 0.08, 1.6 + s * 0.1)
    } else {
      mouse.position.y = 0.767
      mouse.rotation.x = 0
      mouse.scale.set(1, 0.55, 1.6)
    }
    if ((mouse.material as any)?.emissive) {
      const rgbColor = mouseLedOn ? new THREE.Color().setHSL((clock * 0.5) % 1, 0.9, 0.5).getHex() : 0x000000
        ; (mouse.material as any).emissive.setHex(rgbColor)
        ; (mouse.material as any).emissiveIntensity = mouseLedOn ? 0.45 + Math.sin(idleClock * 5) * 0.1 : 0
    }

    // Cosmic Poster frame pop off wall & nebula aura pulse
    const arGlow = clock - artGlowTime
    if (arGlow >= 0 && arGlow < 1.8) {
      const s = getSpring(arGlow, 1.5, 3, 2.5)
      const b = getEaseOutBounce(arGlow, 1.8)
      artFrame.position.x = -3.44 + b * 0.04
      artPlane.position.x = -3.4 + b * 0.04
      artFrame.rotation.z = s * 0.08
      artPlane.rotation.z = s * 0.08
      if ((artPlane.material as any)?.emissiveIntensity !== undefined) {
        ; (artPlane.material as any).emissiveIntensity = 0.18 + Math.sin((arGlow / 1.8) * Math.PI) * 0.75
      }
    } else {
      artFrame.position.x = -3.44
      artPlane.position.x = -3.4
      artFrame.rotation.z = 0
      artPlane.rotation.z = 0
      if ((artPlane.material as any)?.emissiveIntensity !== undefined) {
        ; (artPlane.material as any).emissiveIntensity = 0.18
      }
    }

    // Analog wall clock chime recoil spring pop & face glow
    const clPulse = clock - clockPulseTime
    if (clPulse >= 0 && clPulse < 1.2) {
      const s = getSpring(clPulse, 1.2, 3.5, 2.5)
      const b = getEaseOutBounce(clPulse, 1.2)
      clockGroup.scale.set(1 + s * 0.2, 1 + s * 0.2, 1 + s * 0.15)
      if ((clockFace.material as any)?.emissive) {
        ; (clockFace.material as any).emissive.setHex(0xf0d878)
          ; (clockFace.material as any).emissiveIntensity = Math.sin(b * Math.PI) * 0.6
      }
    } else {
      clockGroup.scale.set(1, 1, 1)
      if ((clockFace.material as any)?.emissive) {
        ; (clockFace.material as any).emissiveIntensity = 0
      }
    }

    // PCB board spring pop & high-speed LED knight-rider scan
    const pcPulse = clock - pcbPulseTime
    if (pcPulse >= 0 && pcPulse < 2.0) {
      const s = getSpring(pcPulse, 1.5, 4, 2.8)
      pcbGroup.scale.setScalar(1 + s * 0.2)
      pcbGroup.position.y = 0.767 + s * 0.02 // pcb rest y = 0.767
      const activeIdx = Math.floor(pcPulse * 12) % 4
      pcbLeds.forEach((led: any, i: number) => {
        if (led.material?.emissiveIntensity !== undefined) {
          led.material.emissiveIntensity = i === activeIdx ? 1.8 : 0.2
        }
      })
    } else {
      pcbGroup.scale.setScalar(1)
      pcbGroup.position.y = 0.767
      pcbLeds.forEach((led: any) => {
        if (led.material?.emissiveIntensity !== undefined) {
          led.material.emissiveIntensity = 0.6
        }
      })
    }

    // Chair 360-degree damped swivel & seat cushion squish bounce
    const chSwiv = clock - chairSwivelTime
    if (chSwiv >= 0 && chSwiv < 1.4) {
      const progress = chSwiv / 1.4
      const s = getSpring(chSwiv, 1.4, 2.5, 2.0)
      chairGroup.rotation.y = Math.sin(progress * Math.PI) * Math.PI
      seat.scale.set(1 + s * 0.1, 1 - s * 0.15, 1 + s * 0.1)
    } else {
      chairGroup.rotation.y = 0
      seat.scale.set(1, 1, 1)
    }

    // Window starlight glow flare & godray beam expansion
    const winGl = clock - winGlowTime
    if (winGl >= 0 && winGl < 2.0) {
      const pulse = Math.sin((winGl / 2.0) * Math.PI)
      godrayMat.opacity = 0.06 + pulse * 0.22
      if ((skyPlane.material as any)?.emissive) {
        ; (skyPlane.material as any).emissive.setHex(0x00f0ff)
          ; (skyPlane.material as any).emissiveIntensity = pulse * 0.4
      }
    } else {
      if ((skyPlane.material as any)?.emissive) {
        ; (skyPlane.material as any).emissiveIntensity = 0
      }
    }

    // Textbooks stack slide-out & spring bounce back
    const bkShift = clock - booksShiftTime
    if (bkShift >= 0 && bkShift < 1.2) {
      const s = getSpring(bkShift, 1.2, 3, 2.5)
      const b = getEaseOutBounce(bkShift, 1.2)
      if (deskBooksGroup.children[2]) {
        deskBooksGroup.children[2].position.x = b * 0.065
        deskBooksGroup.children[2].position.y = 0.012 + 2 * 0.027 + b * 0.015
        deskBooksGroup.children[2].rotation.y = s * 0.35
        deskBooksGroup.children[2].scale.set(1 + s * 0.1, 1 - s * 0.08, 1 + s * 0.1)
      }
    } else {
      if (deskBooksGroup.children[2]) {
        deskBooksGroup.children[2].position.x = 0
        deskBooksGroup.children[2].position.y = 0.012 + 2 * 0.027
        deskBooksGroup.children[2].rotation.y = 0
        deskBooksGroup.children[2].scale.set(1, 1, 1)
      }
    }

    // Sticky note paper peel up, flutter wave & float animation
    const stLift = clock - stickyLiftTime
    if (stLift >= 0 && stLift < 1.2) {
      const s = getSpring(stLift, 1.2, 3, 2.2)
      const b = getEaseOutBounce(stLift, 1.2)
      sticky.position.y = 0.768 + b * 0.045
      sticky.rotation.z = 0.4 + s * 0.25
      sticky.rotation.x = -Math.PI / 2 + s * 0.18
      sticky.scale.set(1 + s * 0.15, 1 + s * 0.15, 1)
    } else {
      sticky.position.y = 0.768
      sticky.rotation.z = 0.4
      sticky.rotation.x = -Math.PI / 2
      sticky.scale.set(1, 1, 1)
    }

    // state logic (wall-clock based so durations hold even at low fps)
    if (state === 'intro') {
      const t = clamp((clock - transStart) / 3.6, 0, 1)
      tweenCamera(CAM.entryStart, CAM.entryEnd, t, easeInOutCubic)
      // gentle handheld
      camera.position.x += Math.sin(idleClock * 0.9) * 0.01 * (1 - t)
      camera.position.y += Math.cos(idleClock * 0.7) * 0.008 * (1 - t)
      // rack-focus: foreground (doorway ~1.5 units) → desk (~3.2 units) as the camera settles
      bokehPass.uniforms.focus.value = lerp(1.5, 3.2, smoothstep(t))
      // aperture eases down as we settle so the blur is strongest mid-move
      bokehPass.uniforms.aperture.value = lerp(0.025, 0.006, t)
      if (t >= 1) {
        // disable DoF once idle — no need to blur the operable scene
        bokehPass.enabled = false
        setState('idle')
      }
    } else if (state === 'idle') {
      // idle sway around entryEnd (damp on hover so the click target stays stable)
      const swayMul = hovering ? 0.15 : 1
      setLook(
        [CAM.entryEnd.pos[0] + sway * swayMul, CAM.entryEnd.pos[1] + sway2 * swayMul, CAM.entryEnd.pos[2]],
        [CAM.entryEnd.look[0], CAM.entryEnd.look[1], CAM.entryEnd.look[2]]
      )
      // subtle hover glow pulse
      if (hovering) {
        screenMat.emissiveIntensity = lerp(screenMat.emissiveIntensity, 0.35 + Math.sin(idleClock * 3) * 0.06, 0.1)
      } else {
        screenMat.emissiveIntensity = lerp(screenMat.emissiveIntensity, 0.04, 0.08)
      }
    } else if (state === 'sitting') {
      const t = clamp((clock - transStart) / 1.8, 0, 1)
      tweenCamera(sitFrom, CAM.seated, t, easeOutCubic)
      // screen wakes
      const wake = smoothstep(clamp((t - 0.4) / 0.6, 0, 1))
      screenMat.emissiveIntensity = lerp(0.04, 0.9, wake)
      screenMat.emissive.setRGB(0.06 + wake * 0.5, 0.08 + wake * 0.6, 0.12 + wake * 0.7)
      // scanline flicker: a bright horizontal line sweeps down + a brief brightness
      // flash during the wake phase (0.4 < t < 1.0), fading out by arrival.
      if (wake > 0.01 && wake < 0.99) {
        const flickerY = lerp(LAPTOP.screenH / 2, -LAPTOP.screenH / 2, wake)
        scanlineFlicker.position.y = 0.41 + flickerY
          ; (scanlineFlicker.material as any).opacity = 0.6 * (1 - Math.abs(wake - 0.5) * 2)
      } else {
        ; (scanlineFlicker.material as any).opacity = 0
      }
      if (t >= 1) {
        setState('seated')
        // mount iframe exactly on arrival
        mountIframe()
        // hand pointer events to iframe
        renderer.domElement.style.pointerEvents = 'none'
        renderer.domElement.style.cursor = 'default'
        screenMat.emissiveIntensity = 0.0 // hide backing glow (iframe covers it)
        screenSheen.visible = false // hide glass sheen (iframe is the live surface now)
          ; (scanlineFlicker.material as any).opacity = 0 // hide scanline flicker
      }
    } else if (state === 'seated') {
      // locked, very subtle breathing
      setLook(
        [CAM.seated.pos[0] + sway * 0.25, CAM.seated.pos[1] + sway2 * 0.25, CAM.seated.pos[2]],
        [LAPTOP.screen[0], LAPTOP.screen[1], LAPTOP.screen[2]]
      )
    } else if (state === 'standingup') {
      const t = clamp((clock - transStart) / 1.4, 0, 1)
      tweenCamera(standFrom, CAM.entryEnd, t, easeInOutCubic)
      screenMat.emissiveIntensity = lerp(0.0, 0.04, t)
      screenSheen.visible = true // restore glass sheen for idle
      if (t >= 1) {
        setState('idle')
      }
    }

    // render
    if (webglActive) {
      composer.render()
    }
    cssRenderer.render(cssScene, camera)
  }

  // throttle room RAF when seated (room mostly occluded by iframe):
  // we keep rendering but it is cheap relative to the active iframe.

  // ---------- resize ----------
  function resize() {
    const w = webglContainer.clientWidth
    const h = webglContainer.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    cssRenderer.setSize(w, h)
    composer.setSize(w, h)
    bloom.setSize(w, h)
  }
  window.addEventListener('resize', resize)

  // ---------- public actions ----------
  function skipIntro() {
    if (state === 'loading' || state === 'intro') {
      setLook(CAM.entryEnd.pos, CAM.entryEnd.look)
      bokehPass.enabled = false
      setState('idle')
    }
  }
  function stepBack() {
    if (state === 'seated') startStandUp()
  }

  // ---------- boot ----------
  if (reduced) {
    // skip everything: seated + iframe immediately, no DoF
    setLook(CAM.seated.pos, CAM.seated.look)
    bokehPass.enabled = false
    setState('seated')
    mountIframe()
    renderer.domElement.style.pointerEvents = 'none'
  } else {
    // don't start the intro yet — wait for startIntro() so the timer begins
    // when the boot screen actually fades (not during scene init)
    setState('loading')
  }
  opts.onReady()
  rafId = requestAnimationFrame(animate)

  function startIntro() {
    if (state !== 'loading' && state !== 'idle') return
    // Reset ALL timing variables so the intro starts fresh — the animate loop
    // may have been running during scene init, accumulating a large/negative clock.
    last = performance.now()
    clock = 0
    transStart = 0
    idleClock = 0
    bokehPass.enabled = true
    setState('intro')
  }

  return {
    dispose: () => {
      disposed = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('click', onClick)
      unmountIframe()
      stopLofiMusic()
      if (audioCtx) { try { audioCtx.close() } catch { } }
      try {
        renderer.dispose()
      } catch { }
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      if (cssRenderer.domElement.parentNode) cssRenderer.domElement.parentNode.removeChild(cssRenderer.domElement)
    },
    skipIntro,
    stepBack,
    resize,
    startIntro,
    toggleMusic,
  }
}

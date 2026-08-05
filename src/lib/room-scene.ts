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
  // grain streaks
  const lines = vertical ? 60 : 70
  for (let i = 0; i < lines; i++) {
    const pos = Math.random() * (vertical ? w : h)
    const len = w * (0.5 + Math.random() * 0.6)
    const thick = 0.5 + Math.random() * 2.2
    ctx.strokeStyle = Math.random() > 0.6 ? dark : grain
    ctx.globalAlpha = 0.15 + Math.random() * 0.35
    ctx.lineWidth = thick
    ctx.beginPath()
    if (vertical) {
      const x = pos
      ctx.moveTo(x, 0)
      for (let y = 0; y <= h; y += 12) {
        ctx.lineTo(x + Math.sin(y * 0.02 + i) * 3, y)
      }
    } else {
      const y = pos
      ctx.moveTo(0, y)
      for (let x = 0; x <= w; x += 12) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3)
      }
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // knots
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = 6 + Math.random() * 16
    const g = ctx.createRadialGradient(x, y, 1, x, y, r)
    g.addColorStop(0, dark)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  noiseFill(ctx, w, h, 16)
  return c
}

function plasterTexture(opts: { base: string; w?: number; h?: number }) {
  const { base, w = 1536, h = 1536 } = opts
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  // faint vertical shade variation
  for (let i = 0; i < 8; i++) {
    const x = (i / 8) * w
    const g = ctx.createLinearGradient(x, 0, x + w / 8, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.04)')
    g.addColorStop(1, 'rgba(255,255,255,0.02)')
    ctx.fillStyle = g
    ctx.fillRect(x, 0, w / 8, h)
  }
  noiseFill(ctx, w, h, 22)
  // a couple of faint seams
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w * 0.33, 0)
  ctx.lineTo(w * 0.33, h)
  ctx.moveTo(w * 0.72, 0)
  ctx.lineTo(w * 0.72, h)
  ctx.stroke()
  return c
}

function metalTexture(opts: { base: string; w?: number; h?: number }) {
  const { base, w = 512, h = 512 } = opts
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  // brushed metal fine scratches
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const len = 2 + Math.random() * 14
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.06})`
    if (Math.random() > 0.5) ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.08})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
  }
  noiseFill(ctx, w, h, 10)
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
    const v = clamp(base + lum * 0.3, 0, 1) * 255
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

function artTexture(): HTMLCanvasElement {
  const w = 512
  const h = 640
  const [c, ctx] = mkCanvas(w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#241a2e')
  g.addColorStop(0.5, '#5a3340')
  g.addColorStop(1, '#c8784e')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // abstract shapes
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(${20 + Math.random() * 80},${10 + Math.random() * 40},${30 + Math.random() * 60},${0.5})`
    ctx.beginPath()
    ctx.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 120, 20 + Math.random() * 80, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  noiseFill(ctx, w, h, 14)
  return c
}

function rugTexture(): HTMLCanvasElement {
  const w = 512
  const h = 512
  const [c, ctx] = mkCanvas(w, h)
  ctx.fillStyle = '#3a2230'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#6a3a44'
  ctx.lineWidth = 6
  ctx.strokeRect(24, 24, w - 48, h - 48)
  ctx.strokeStyle = '#c8946a'
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, w - 80, h - 80)
  // diamond pattern
  ctx.strokeStyle = 'rgba(200,148,106,0.5)'
  for (let y = 60; y < h - 60; y += 50) {
    for (let x = 60; x < w - 60; x += 50) {
      ctx.beginPath()
      ctx.moveTo(x, y - 18)
      ctx.lineTo(x + 18, y)
      ctx.lineTo(x, y + 18)
      ctx.lineTo(x - 18, y)
      ctx.closePath()
      ctx.stroke()
    }
  }
  noiseFill(ctx, w, h, 18)
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

// ---------- scene types ----------
export type SceneState = 'loading' | 'intro' | 'idle' | 'sitting' | 'seated' | 'standingup'

export interface RoomSceneOptions {
  webglContainer: HTMLElement
  css3dContainer: HTMLElement
  portfolioUrl: string
  onState: (s: SceneState) => void
  onHover: (h: boolean) => void
  onReady: () => void
  reducedMotion?: boolean
}

export interface RoomScene {
  dispose: () => void
  skipIntro: () => void
  stepBack: () => void
  resize: () => void
  startIntro: () => void
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

  const fabricCanvas = (() => {
    const [c, ctx] = mkCanvas(256, 256)
    ctx.fillStyle = '#4a3a3a'
    ctx.fillRect(0, 0, 256, 256)
    noiseFill(ctx, 256, 256, 28)
    return c
  })()
  const fabricMat = new THREE.MeshStandardMaterial({
    map: texOpts(fabricCanvas),
    roughness: 0.95,
    metalness: 0,
  })

  const ceramicDark = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.1 })
  const plantPotMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8, metalness: 0 })
  const bookMats = [0x8a3a3a, 0x3a5a8a, 0x6a6a3a, 0x5a3a6a, 0x3a6a5a, 0x8a6a3a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0 })
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
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })
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
  // curtain rod + curtains (mounted on back wall above window)
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, winW + 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 })
  )
  rod.rotation.z = Math.PI / 2
  rod.position.set(winX, winY + winH / 2 + 0.18, winZ + 0.06)
  group.add(rod)
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x3a2230, roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  const curtainL = new THREE.Mesh(new THREE.PlaneGeometry(0.42, winH + 0.5), curtainMat)
  curtainL.position.set(winX - winW / 2 - 0.18, winY + 0.05, winZ + 0.05)
  curtainL.rotation.z = 0.06
  group.add(curtainL)
  const curtainR = new THREE.Mesh(new THREE.PlaneGeometry(0.42, winH + 0.5), curtainMat)
  curtainR.position.set(winX + winW / 2 + 0.18, winY + 0.05, winZ + 0.05)
  curtainR.rotation.z = -0.06
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
  // desk drawer front
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.04), deskMat)
  drawer.position.set(0.6, 0.5, 0.42)
  deskGroup.add(drawer)
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x9a8a70, metalness: 0.8, roughness: 0.3 })
  )
  handle.rotation.z = Math.PI / 2
  handle.position.set(0.6, 0.5, 0.45)
  deskGroup.add(handle)

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
  ;(bulbHalo2.material as any).opacity = 0.35
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
  mugGroup.position.set(-0.78, 0.765, -1.92)
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
  steam.position.set(-0.78, 0.765 + coffeeY, -1.92)
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
  // cable laptop -> power strip (subtle)
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 })
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.4, 0.76, -1.85),
    new THREE.Vector3(-1.1, 0.7, -1.7),
    new THREE.Vector3(-0.6, 0.71, -1.6),
    new THREE.Vector3(-0.2, 0.7, -1.5),
  ])
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 24, 0.006, 8, false), cableMat)
  group.add(cable)
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6, metalness: 0.3 })
  )
  strip.position.set(-0.05, 0.755, -1.46)
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

  // ----- headphones hanging on the chair back (clutter = inhabited) -----
  const hpGroup = new THREE.Group()
  hpGroup.position.set(-1.15, 0.92, -1.4)
  hpGroup.rotation.set(0.1, -0.3, 0.2)
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
  // dangling cable
  const hpCable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.13, -0.04, 0),
        new THREE.Vector3(0.18, -0.18, 0.02),
        new THREE.Vector3(0.12, -0.32, 0.06),
        new THREE.Vector3(0.0, -0.4, 0.1),
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
  // phone screen glow (front face)
  const phoneScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.065, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x1a2a3a })
  )
  phoneScreen.position.copy(phone.position)
  phoneScreen.position.z += 0.004
  phoneScreen.rotation.copy(phone.rotation)
  phoneGroup.add(phoneScreen)

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
  ;(godray2.material as any).opacity = 0.06
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

  // ----- wall clock (small detail) -----
  const clockFrame = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.03, 28),
    new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.5 })
  )
  clockFrame.rotation.x = Math.PI / 2
  clockFrame.position.set(-2.75, 2.35, -2.96)
  group.add(clockFrame)
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 28),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.5 })
  )
  clockFace.position.set(-2.75, 2.35, -2.945)
  group.add(clockFace)
  const handMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 })
  // clock hands — geometry offset so origin is at the clock center (real-time rotation)
  const hourGeo = new THREE.BoxGeometry(0.013, 0.075, 0.004)
  hourGeo.translate(0, 0.0375, 0)
  const hourHand = new THREE.Mesh(hourGeo, handMat)
  hourHand.position.set(-2.75, 2.35, -2.942)
  group.add(hourHand)
  const minGeo = new THREE.BoxGeometry(0.009, 0.105, 0.004)
  minGeo.translate(0, 0.0525, 0)
  const minHand = new THREE.Mesh(minGeo, handMat)
  minHand.position.set(-2.75, 2.35, -2.943)
  group.add(minHand)
  const secGeo = new THREE.BoxGeometry(0.003, 0.11, 0.002)
  secGeo.translate(0, 0.055, 0)
  const secHand = new THREE.Mesh(secGeo, new THREE.MeshStandardMaterial({ color: 0xc8624a, roughness: 0.4, emissive: 0xc8624a, emissiveIntensity: 0.3 }))
  secHand.position.set(-2.75, 2.35, -2.944)
  group.add(secHand)
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
  // clock tick marks
  const tickMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.003), tickMat)
    tick.position.set(-2.75 + Math.sin(a) * 0.12, 2.35 + Math.cos(a) * 0.12, -2.935)
    group.add(tick)
  }

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
    if (state !== 'idle') return
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(screenMesh, false)
    const h = hit.length > 0
    if (h !== hovering) {
      hovering = h
      opts.onHover(h)
      renderer.domElement.style.cursor = h ? 'pointer' : 'default'
    }
  }
  function onClick(e: MouseEvent) {
    if (state !== 'idle') return
    // raycast directly at the click/tap point so touch devices (no prior hover) work
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(screenMesh, false)
    if (hit.length > 0) startSitDown()
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

    // lamp flicker (near-zero amplitude) — base matches the new 2.8-intensity bulb
    lampLight.intensity = 2.8 + Math.sin(idleClock * 11.0) * 0.05 + Math.sin(idleClock * 3.3) * 0.04
    // standby LED breathing (only when not seated — screen is "asleep")
    const ledOn = state !== 'seated'
    const ledPulse = ledOn ? 0.7 + Math.sin(idleClock * 1.2) * 0.25 : 0.0
    ;(standbyLed.material as any).opacity = lerp((standbyLed.material as any).opacity, ledPulse, 0.1)
    ;(ledHalo.material as any).opacity = lerp((ledHalo.material as any).opacity, ledPulse * 0.45, 0.1)
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
    steamMat.opacity = 0.18 + Math.sin(idleClock * 0.8) * 0.06

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
    ;(godray2.material as any).opacity = 0.05 + Math.cos(idleClock * 0.45) * 0.012

    // real-time wall clock
    setClock()

    // hover glow rim on the laptop screen
    const targetGlow = hovering ? 0.5 + Math.sin(idleClock * 3) * 0.08 : 0.0
    ;(screenGlow.material as any).opacity = lerp((screenGlow.material as any).opacity, targetGlow, 0.12)

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
        ;(scanlineFlicker.material as any).opacity = 0.6 * (1 - Math.abs(wake - 0.5) * 2)
      } else {
        ;(scanlineFlicker.material as any).opacity = 0
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
        ;(scanlineFlicker.material as any).opacity = 0 // hide scanline flicker
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
      try {
        renderer.dispose()
      } catch {}
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      if (cssRenderer.domElement.parentNode) cssRenderer.domElement.parentNode.removeChild(cssRenderer.domElement)
    },
    skipIntro,
    stepBack,
    resize,
    startIntro,
  }
}

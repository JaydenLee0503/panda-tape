import './style.css'
import { initPlan } from './plan.js'
import { supabase } from './supabase.js'

/*
 * Panda Tape — pinned-scroll hero engine.
 * Ported 1:1 from the prototype's `renderVals`: every phase is a pure
 * function of the normalized scroll progress `p` (0 -> 1). No time-based
 * tweens — the frame is recomputed each scroll tick.
 */

const PIN_LENGTH_VH = 860 // --pin: 860vh

const state = { p: 0, words: 0, reserved: false }

const $ = (id) => document.getElementById(id)

// Cache the dynamic elements once.
const el = {
  root: $('root'),
  frame: $('frame'),
  zoom: $('zoom'),
  slot: $('slot'),
  stats: $('stats'),
  turnShade: $('turnShade'),
  recycle: $('recycle'),
  problem: $('problem'),
  rollBar: $('rollBar'),
  tape: $('tape'),
  roll: $('roll'),
  head: $('head'),
  sw1: $('sw1'), sw2: $('sw2'), sw3: $('sw3'),
  rw1: $('rw1'), rw2: $('rw2'), rw3: $('rw3'),
  pw1: $('pw1'), pw2: $('pw2'), pw3: $('pw3'),
  w1: $('w1'), w2: $('w2'), w3: $('w3'),
  st2: $('st2'), st4: $('st4'), st5: $('st5'),
}

function setStyle(node, obj) {
  if (!node) return
  Object.assign(node.style, obj)
}

const clamp01 = (x) => Math.max(0, Math.min(1, x))

function renderVals() {
  const p = state.p
  const words = state.words
  const pop = 'transform .55s cubic-bezier(.34,1.55,.6,1), opacity .4s ease'
  const pA = 0.62
  const q = clamp01((p - pA) / (1 - pA))

  // stats words: pop on load (timers), ride the page-turn out
  const sword = (i) => {
    const on = words > i && p < 0.14
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0) scale(1)' : 'translateY(40px) scale(.95)',
      transition: pop,
    }
  }
  // stats page-turn: 0 -> 1 flips the desk photo away like a page
  const turnS = clamp01((p - 0.06) / 0.09)

  // recycling (trash can) words: reveal, then ride the overlay lift
  const rword = (i) => {
    const enter = p > 0.10 + i * 0.03
    const exit = p > 0.30
    const on = enter && !exit
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0) scale(1)' : (exit ? 'translateY(-70px) scale(1.04)' : 'translateY(46px) scale(.96)'),
      transition: pop,
    }
  }
  // problem section unrolls down over the trash scene like paper off a roll
  const rollIn = clamp01((p - 0.30) / 0.14)

  // problem words: scroll-driven pop, fly up as the overlay exits
  const pword = (i) => {
    const enter = p > 0.34 + i * 0.03
    const exit = p > 0.55
    const on = enter && !exit
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0) scale(1)' : (exit ? 'translateY(-70px) scale(1.06)' : 'translateY(70px) scale(.92)'),
      transition: pop,
    }
  }
  // big KT-tape strip wipes across the screen to reveal the composted section
  const tapeWipe = clamp01((p - 0.55) / 0.10)

  // "we composted that": scroll-driven pop after the problem phase
  const word = (i) => {
    const enter = q > 0.02 + i * 0.045
    const exit = q > 0.20 + i * 0.03
    const on = enter && !exit
    return {
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0) scale(1)' : (exit ? 'translateY(-70px) scale(1.06)' : 'translateY(70px) scale(.92)'),
      transition: pop,
    }
  }

  const stick = (th, rot) => {
    const on = q > th
    return {
      opacity: on ? 1 : 0,
      transform: 'rotate(' + rot + 'deg) scale(' + (on ? 1 : 0.2) + ')',
      transition: pop,
    }
  }

  const s = Math.max(0, Math.min(1, (p - 0.90) / 0.10))
  const se = 1 - Math.pow(1 - s, 3) // ease-out for the zoom-out

  return {
    rollShow: clamp01((tapeWipe - 0.45) / 0.4) * clamp01((0.42 - q) / 0.08),
    frameStyle: {
      position: 'absolute', inset: 0, overflow: 'hidden',
      transform: 'scale(' + (1 - se * 0.20) + ') rotate(' + (se * -1.5) + 'deg)',
      borderRadius: (se * 56) + 'px',
      boxShadow: '0 ' + (se * 40) + 'px ' + (se * 90) + 'px rgba(35,40,31,' + (se * 0.30) + ')',
      willChange: 'transform',
    },
    zoomStyle: {
      position: 'absolute', inset: '-8%',
      transform: 'scale(' + (1 + Math.min(q, 0.6) * 0.22) + ')',
      willChange: 'transform',
    },
    problemStyle: {
      position: 'absolute', inset: 0, zIndex: 9,
      transformOrigin: 'top center',
      transform: 'none',
      clipPath: 'inset(0 0 ' + ((1 - rollIn) * 100) + '% 0)',
      opacity: clamp01((0.63 - tapeWipe) / 0.24),
      overflow: 'hidden', willChange: 'clip-path, opacity',
      boxShadow: '0 40px 80px rgba(0,0,0,.35)',
      pointerEvents: (tapeWipe > 0.5 || rollIn <= 0) ? 'none' : 'auto',
    },
    tapeStyle: {
      position: 'absolute', left: '50%', top: '50%', width: '200vw', height: '112vw', zIndex: 12,
      transform: 'translate(-50%,-50%) translate(' + ((tapeWipe - 0.5) * 260) + 'vw, ' + ((0.5 - tapeWipe) * 260) + 'vh) scaleX(-1)',
      backgroundImage: "url('/uploads/kt-tape-strip.png')",
      backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
      filter: 'drop-shadow(0 26px 54px rgba(0,0,0,.55))',
      opacity: (tapeWipe > 0.001 && tapeWipe < 0.999) ? 1 : 0,
      pointerEvents: 'none', willChange: 'transform',
    },
    rollBarStyle: {
      position: 'absolute', left: '-4%', right: '-4%', height: '52px', zIndex: 10,
      top: 'calc(' + (rollIn * 100) + '% - 34px)',
      opacity: (rollIn > 0.01 && rollIn < 0.99) ? 1 : 0,
      background: 'linear-gradient(180deg, rgba(255,255,255,.4), rgba(70,80,60,.95) 34%, #14120f 72%, rgba(0,0,0,.5))',
      borderRadius: '40px',
      boxShadow: '0 20px 46px rgba(0,0,0,.55), inset 0 2px 4px rgba(255,255,255,.35)',
      transition: 'opacity .18s linear',
      pointerEvents: 'none',
    },
    statsStyle: {
      position: 'absolute', inset: 0, zIndex: 8,
      transform: 'perspective(1900px) rotateY(' + (-turnS * 108) + 'deg)',
      transformOrigin: 'left center',
      borderRadius: turnS > 0 ? '0 64px 64px 0' : '0',
      overflow: 'hidden', willChange: 'transform', backfaceVisibility: 'hidden',
      boxShadow: turnS > 0 ? ('40px 0 90px rgba(0,0,0,' + (turnS * 0.45) + ')') : '0 40px 80px rgba(0,0,0,.35)',
      pointerEvents: turnS >= 1 ? 'none' : 'auto',
    },
    turnShade: {
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,0) 55%)',
      opacity: turnS, transition: 'opacity .15s linear',
    },
    recycleStyle: {
      position: 'absolute', inset: 0, zIndex: 7,
      transform: 'none',
      opacity: rollIn >= 0.99 ? 0 : 1,
      overflow: 'hidden', willChange: 'transform',
      boxShadow: '0 40px 80px rgba(0,0,0,.35)',
      pointerEvents: rollIn >= 1 ? 'none' : 'auto',
    },
    rw1: rword(0), rw2: rword(1), rw3: rword(2),
    sw1: sword(0), sw2: sword(1), sw3: sword(2),
    pw1: pword(0), pw2: pword(1), pw3: pword(2),
    w1: word(0), w2: word(1), w3: word(2),
    st2: stick(0.34, 8),
    st4: stick(0.42, -7),
    st5: stick(0.46, -4),
    slotStyle: {
      width: '100%', height: '100%',
      opacity: q < 0.01 ? 1 : 0,
      transform: q < 0.01 ? 'scale(1)' : 'scale(.7)',
      transition: 'opacity .5s ease, transform .6s ease',
      pointerEvents: q < 0.01 ? 'auto' : 'none',
    },
    headStyle: {
      opacity: q > 0.56 ? 1 : 0,
      transform: q > 0.56 ? 'translateY(0)' : 'translateY(60px)',
      transition: 'opacity .7s ease, transform .7s cubic-bezier(.2,.8,.2,1)',
      pointerEvents: q > 0.56 ? 'auto' : 'none',
    },
  }
}

function render() {
  const v = renderVals()
  setStyle(el.frame, v.frameStyle)
  setStyle(el.zoom, v.zoomStyle)
  setStyle(el.slot, v.slotStyle)
  setStyle(el.stats, v.statsStyle)
  setStyle(el.turnShade, v.turnShade)
  setStyle(el.recycle, v.recycleStyle)
  setStyle(el.problem, v.problemStyle)
  setStyle(el.rollBar, v.rollBarStyle)
  setStyle(el.tape, v.tapeStyle)
  setStyle(el.head, v.headStyle)
  el.roll.style.opacity = String(v.rollShow)

  setStyle(el.sw1, v.sw1); setStyle(el.sw2, v.sw2); setStyle(el.sw3, v.sw3)
  setStyle(el.rw1, v.rw1); setStyle(el.rw2, v.rw2); setStyle(el.rw3, v.rw3)
  setStyle(el.pw1, v.pw1); setStyle(el.pw2, v.pw2); setStyle(el.pw3, v.pw3)
  setStyle(el.w1, v.w1); setStyle(el.w2, v.w2); setStyle(el.w3, v.w3)
  setStyle(el.st2, v.st2); setStyle(el.st4, v.st4); setStyle(el.st5, v.st5)
}

// ---------- scroll -> progress ----------
let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const vh = window.innerHeight
    const pin = (PIN_LENGTH_VH / 100) * vh
    const len = Math.max(1, pin - vh)
    const p = Math.max(0, Math.min(1, window.scrollY / len))
    if (Math.abs(p - state.p) > 0.001) {
      state.p = p
      render()
    }
  })
}

// ---------- intro word reveal (timers, exactly like the prototype) ----------
let timers = []
function startIntro(delay) {
  timers.forEach(clearTimeout)
  timers = [
    setTimeout(() => { state.words = 1; render() }, delay),
    setTimeout(() => { state.words = 2; render() }, delay + 550),
    setTimeout(() => { state.words = 3; render() }, delay + 1100),
  ]
}

// ---------- footer reserve form ----------
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Persist an email to the Supabase `reservations` table.
 * Returns true on success (a duplicate email counts as success — they're
 * already on the list). If Supabase isn't configured, we no-op to true so the
 * form still "works" in a bare local checkout.
 */
async function saveReservation(email, source) {
  if (!supabase) return true
  const { error } = await supabase.from('reservations').insert({ email, source })
  if (error && error.code !== '23505') {
    // 23505 = unique violation (already reserved) — that's fine.
    console.warn('[panda] reservation failed:', error.message)
    return false
  }
  return true
}

async function reserve() {
  const btn = $('reserveBtn')
  const note = $('reserveNote')
  const input = document.querySelector('#footer input[type="email"]')
  const email = (input?.value || '').trim()

  if (!EMAIL_RE.test(email)) {
    if (note) note.textContent = 'PLEASE ENTER A VALID EMAIL ADDRESS.'
    input?.focus()
    return
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…' }
  const ok = await saveReservation(email, 'footer')

  if (ok) {
    state.reserved = true
    if (btn) btn.textContent = "You're in"
    if (note) note.textContent = "YOU'RE ON THE LIST. WE'LL WRITE SOON."
    if (input) input.disabled = true
  } else {
    if (btn) { btn.disabled = false; btn.textContent = 'Reserve' }
    if (note) note.textContent = 'SOMETHING WENT WRONG — PLEASE TRY AGAIN.'
  }
}

function goReserve() {
  const f = $('footer')
  if (f) window.scrollTo({ top: f.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' })
}

function replay() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  state.words = 0
  render()
  startIntro(700)
}

// ---------- wire up ----------
$('reserveBtn')?.addEventListener('click', reserve)
document.querySelector('#footer input[type="email"]')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); reserve() }
})
$('dockReserve')?.addEventListener('click', goReserve)
$('dockMenu')?.addEventListener('click', goReserve)
$('dockReplay')?.addEventListener('click', replay)

// "See the plan" overlay (map + roadmap)
const plan = initPlan({ onReserve: goReserve })
$('dockPlan')?.addEventListener('click', () => plan?.open())

window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('resize', onScroll)

// Fallback reveal for browsers without scroll-driven animations (view() timelines)
if (!CSS.supports('animation-timeline: view()')) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible')
        io.unobserve(e.target)
      }
    }
  }, { threshold: 0.15 })
  document.querySelectorAll('.pt-rise, .pt-zoom-in').forEach((n) => io.observe(n))
}

// initial paint + intro
render()
onScroll()
startIntro(400)

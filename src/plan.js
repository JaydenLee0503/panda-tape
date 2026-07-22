/*
 * Panda Tape — "See the plan" overlay.
 * Drives the slide-up sheet with two tabs: a live drop-off Map (Leaflet +
 * Foursquare) and the product Roadmap. Everything initialises lazily the first
 * time the overlay is opened so it costs nothing on landing.
 */
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getPandaPoints, DEFAULT_CENTER, formatMiles } from './places.js'

const $ = (id) => document.getElementById(id)

export function initPlan({ onReserve } = {}) {
  const overlay = $('planOverlay')
  if (!overlay) return

  const sheet = overlay.querySelector('.plan-sheet')
  const tabs = Array.from(overlay.querySelectorAll('.plan-tab'))
  const ink = overlay.querySelector('.plan-tab-ink')
  const panels = Array.from(overlay.querySelectorAll('.plan-panel'))
  const listEl = $('planList')
  const statusEl = $('planMapStatus')
  const locateBtn = $('planLocate')
  const loadingEl = $('planMapLoading')

  let map = null
  let markerLayer = null
  let youMarker = null
  const markersById = new Map()
  let lastFocusedTrigger = null

  // ---------- open / close ----------
  function open() {
    lastFocusedTrigger = document.activeElement
    overlay.classList.add('is-open')
    overlay.setAttribute('aria-hidden', 'false')
    document.body.classList.add('plan-open')
    ensureMap()
    // Underline needs a laid-out tab; run after the sheet starts showing.
    requestAnimationFrame(() => moveInk(activeTab()))
  }

  function close() {
    overlay.classList.remove('is-open')
    overlay.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('plan-open')
    if (lastFocusedTrigger && lastFocusedTrigger.focus) lastFocusedTrigger.focus()
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close() // click the dim backdrop
  })
  $('planClose')?.addEventListener('click', close)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close()
  })

  // ---------- tabs ----------
  const activeTab = () => tabs.find((t) => t.classList.contains('is-active')) || tabs[0]

  function moveInk(tab) {
    if (!tab || !ink) return
    ink.style.left = `${tab.offsetLeft}px`
    ink.style.width = `${tab.offsetWidth}px`
  }

  function selectTab(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name
      t.classList.toggle('is-active', on)
      t.setAttribute('aria-selected', String(on))
    })
    panels.forEach((p) => {
      const on = p.dataset.panel === name
      p.classList.toggle('is-active', on)
      p.hidden = !on
    })
    moveInk(activeTab())
    if (name === 'map' && map) setTimeout(() => map.invalidateSize(), 60)
  }

  tabs.forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)))
  window.addEventListener('resize', () => moveInk(activeTab()))

  // roadmap "Reserve a roll" CTA
  overlay.querySelector('[data-go="reserve"]')?.addEventListener('click', () => {
    close()
    if (onReserve) onReserve()
  })

  // ---------- map ----------
  function ensureMap() {
    if (map) return
    map = L.map('planMap', { zoomControl: true, attributionControl: true, scrollWheelZoom: true })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)
    markerLayer = L.layerGroup().addTo(map)
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13)
    // Leaflet mis-measures inside the animating sheet; nudge it a few times.
    ;[80, 260, 500].forEach((ms) => setTimeout(() => map.invalidateSize(), ms))
    if (loadingEl) loadingEl.remove()
    loadPoints(DEFAULT_CENTER, { isDefault: true })
  }

  const pandaIcon = () =>
    L.divIcon({ className: '', html: '<div class="panda-pin"></div>', iconSize: [20, 20], iconAnchor: [10, 18] })
  const youIcon = () =>
    L.divIcon({ className: '', html: '<div class="panda-pin is-you"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })

  function focusPoint(id) {
    const m = markersById.get(id)
    if (!m) return
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 15), { animate: true })
    m.openPopup()
    listEl.querySelectorAll('.map-item').forEach((n) => n.classList.toggle('is-active', n.dataset.id === id))
  }

  function renderList(points) {
    listEl.innerHTML = ''
    if (!points.length) {
      const empty = document.createElement('div')
      empty.className = 'map-empty'
      empty.textContent = 'No Panda points to show right now.'
      listEl.appendChild(empty)
      return
    }
    points.forEach((p) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'map-item'
      item.dataset.id = p.id
      item.innerHTML =
        `<div class="map-item-body">` +
        `<div class="map-item-name"></div>` +
        `<div class="map-item-meta"></div>` +
        `</div>` +
        `<div class="map-item-dist"></div>`
      item.querySelector('.map-item-name').textContent = p.name
      item.querySelector('.map-item-meta').textContent = [p.category, p.address].filter(Boolean).join(' · ')
      item.querySelector('.map-item-dist').textContent = formatMiles(p.distance)
      item.addEventListener('click', () => focusPoint(p.id))
      listEl.appendChild(item)
    })
  }

  function renderMarkers(points) {
    markerLayer.clearLayers()
    markersById.clear()
    points.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon: pandaIcon() }).addTo(markerLayer)
      const meta = [p.category, p.address].filter(Boolean).join(' · ')
      m.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br>${escapeHtml(meta)}<br>${formatMiles(p.distance)} away`)
      markersById.set(p.id, m)
    })
  }

  async function loadPoints(center, { isDefault = false } = {}) {
    setStatus(isDefault ? `Panda points near ${DEFAULT_CENTER.label}…` : 'Finding Panda points near you…')
    const { points, live } = await getPandaPoints(center)
    renderMarkers(points)
    renderList(points)

    map.invalidateSize() // container may still be settling on first open
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    if (youMarker) bounds.extend(youMarker.getLatLng())
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    else map.setView([center.lat, center.lng], 13) // nothing to fit — keep a sensible view

    if (!live || !points.length) {
      setStatus('Couldn’t load nearby Panda points right now. Please try again later.')
      return
    }
    if (isDefault) setStatus(`Live from Foursquare · ${DEFAULT_CENTER.label}. Tap “Use my location” for spots near you.`)
    else setStatus(`Live from Foursquare · ${points.length} Panda points near you.`)
  }

  function locate() {
    if (!navigator.geolocation) {
      setStatus('Location isn’t available in this browser.')
      return
    }
    locateBtn.disabled = true
    setStatus('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        if (youMarker) youMarker.remove()
        youMarker = L.marker([center.lat, center.lng], { icon: youIcon() })
          .addTo(map)
          .bindPopup('You are here')
        loadPoints(center).finally(() => (locateBtn.disabled = false))
      },
      (err) => {
        locateBtn.disabled = false
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — showing Brooklyn, NY instead.'
            : 'Couldn’t get your location — showing Brooklyn, NY instead.'
        )
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }

  locateBtn?.addEventListener('click', locate)

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text
  }

  return { open, close }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

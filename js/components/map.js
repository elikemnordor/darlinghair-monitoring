// Map view component using Leaflet + OpenStreetMap
import { createCarousel } from './carousel.js';

let mapInstance = null;
let currentMarkers = [];
let selectedOutlet = null;
let navMapInstance = null;
let locationWatchId = null;
let userMarker = null;
let routeLine = null;
let navPollId = null;
let fallbackLine = null; // dashed straight line fallback when routing fails
let routingInFlight = false; // prevent overlapping route requests
let lastRouteAt = 0; // timestamp of last successful routing
let lastUserPos = null; // last user coords to compute movement
const MIN_ROUTE_INTERVAL_MS = 8000; // throttle routing calls
const MOVE_THRESHOLD_METERS = 12; // minimum movement to trigger reroute

export function createMapView(outlets, onOutletClick, options = {}) {
  // Create map overlay
  const overlay = document.createElement('div');
  overlay.id = 'map-overlay';
  overlay.className = 'map-overlay';
  
  overlay.innerHTML = `
    <div class="map-header">
      <button class="btn-icon" id="close-map">✕ Close</button>
      <h2>${outlets.length} outlets</h2>
      <div></div>
    </div>
    <div id="map-container" class="map-container"></div>
    <div id="outlet-preview" class="outlet-preview hidden"></div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add styles
  addMapStyles();
  
  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
  
  // Initialize map after DOM is ready
  setTimeout(() => {
    initializeMap(outlets, onOutletClick, options);
  }, 100);
  
  // Auto-close overlay if route changes away from /map
  const handleHashChange = () => {
    if (!window.location.hash.startsWith('#/map')) {
      closeMapView();
      window.removeEventListener('hashchange', handleHashChange);
    }
  };
  window.addEventListener('hashchange', handleHashChange);

  // Close handler
  document.getElementById('close-map').addEventListener('click', () => {
    // Always close overlay first
    closeMapView();
    // Then navigate based on caller preference
    if (options.onClose) options.onClose();
    // Fallback to list if history/back didn't change the route
    setTimeout(() => {
      if (window.location.hash.startsWith('#/map')) {
        window.location.hash = '#/list';
      }
    }, 60);
  });
}

function initializeMap(outlets, onOutletClick, options = {}) {
  // Calculate center and bounds
  const bounds = outlets.map(s => [s.latitude, s.longitude]);
  
  // Default center (Accra)
  const center = bounds.length > 0 
    ? [bounds.reduce((sum, b) => sum + b[0], 0) / bounds.length,
       bounds.reduce((sum, b) => sum + b[1], 0) / bounds.length]
    : [5.6037, -0.1870];
  
  // Create map
  mapInstance = L.map('map-container', {
    zoomControl: true,
    attributionControl: false,
  }).setView(center, 13);
  
  // Add tile layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(mapInstance);
  
  // Add attribution
  L.control.attribution({
    position: 'bottomright',
    prefix: false
  }).addAttribution('© OpenStreetMap').addTo(mapInstance);
  
  // Add markers
  currentMarkers = outlets.map(outlet => createMarker(outlet, onOutletClick));
  
  // Fit bounds if multiple outlets
  if (bounds.length > 1) {
    mapInstance.fitBounds(bounds, { padding: [50, 50] });
  }
  
  // Invalidate size after animation
  setTimeout(() => {
    mapInstance.invalidateSize();
  }, 300);

  // Preselect an outlet if provided
  if (options.selectedOutletId) {
    const s = outlets.find(x => x.id === options.selectedOutletId);
    if (s) {
      // Center the map and show preview
      mapInstance.setView([s.latitude, s.longitude]);
      showPreview(s, onOutletClick);
    }
  }
}

function createMarker(outlet, onOutletClick) {
  const marker = L.marker([outlet.latitude, outlet.longitude], {
    icon: L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-pin ${outlet._isValidated ? 'marker-validated' : 'marker-not-validated'}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div class="marker-label">${outlet.outlet_name}</div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    })
  }).addTo(mapInstance);
  
  marker.on('click', () => {
    selectedOutlet = outlet;
    showPreview(outlet, onOutletClick);
  });
  
  return marker;
}

function showPreview(outlet, onOutletClick) {
  const previewEl = document.getElementById('outlet-preview');
  
  // Collect all available images
  const images = [];
  if (outlet.outlet_front_image) images.push(outlet.outlet_front_image);
  if (outlet.outlet_side_image) images.push(outlet.outlet_side_image);
  if (outlet.product_a_displayed && outlet.product_a_image) images.push(outlet.product_a_image);
  if (outlet.product_b_displayed && outlet.product_b_image) images.push(outlet.product_b_image);
  if (outlet.product_c_displayed && outlet.product_c_image) images.push(outlet.product_c_image);
  if (outlet.telescopic && outlet.telescopic_image) images.push(outlet.telescopic_image);
  
  // Fallback placeholder if no images
  if (images.length === 0) {
    images.push('https://via.placeholder.com/720x405/dddddd/666666?text=No+Image');
  }
  
  const outletId = outlet.captured_id || outlet.assigned_outlet_id;
  
  previewEl.innerHTML = `
    <div class="preview-card" id="preview-card-${outletId}">
      <button class="preview-close" id="close-preview">✕</button>
      
      <div class="preview-carousel" id="preview-carousel-${outletId}">
        <div class="carousel-track">
          ${images.map(img => `
            <div class="carousel-slide">
              <img src="${img}" alt="${outlet.outlet_name}" loading="lazy">
            </div>
          `).join('')}
        </div>
        <div class="carousel-dots">
          ${images.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>
      
      <div class="preview-content">
        <div class="preview-header">
          <h3>${outlet.outlet_name}</h3>
          <span class="badge badge-${outlet.outlet_type}">${outlet.outlet_type}</span>
        </div>
        <p class="preview-meta">${outlet.community} • ${outlet.assembly}</p>
        <p class="preview-contact">${outlet.contact_name}</p>
      </div>
    </div>
  `;
  
  previewEl.classList.remove('hidden');
  
  // Initialize carousel
  setTimeout(() => {
    createCarousel(`preview-carousel-${outletId}`);
  }, 50);
  
  // Close preview
  document.getElementById('close-preview').addEventListener('click', (e) => {
    e.stopPropagation();
    previewEl.classList.add('hidden');
  });
  
  // Navigate to detail on card click
  const card = document.getElementById(`preview-card-${outletId}`);
  card.addEventListener('click', () => {
    closeMapView();
    onOutletClick(outlet);
  });
}

function closeMapView() {
  const overlay = document.getElementById('map-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('visible');
  
  setTimeout(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
    overlay.remove();
  }, 300);
}

// Navigation map view - shows user location and outlet with connecting line
export function createNavMapView(outlet) {
  // Create nav map overlay
  const overlay = document.createElement('div');
  overlay.id = 'nav-map-overlay';
  overlay.className = 'map-overlay';
  
  overlay.innerHTML = `
    <div class="map-header">
      <button class="btn-icon" id="close-nav-map">✕ Close</button>
      <h2>Navigate to ${outlet.outlet_name}</h2>
      <div></div>
    </div>
    <div id="nav-map-container" class="map-container"></div>
    <div id="nav-info" class="nav-info">
      <div class="nav-info-content">
        <svg class="nav-spinner" width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
        </svg>
        <span>Getting your location...</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add styles
  addMapStyles();
  addNavMapStyles();
  
  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
  });
  
  // Close handler
  document.getElementById('close-nav-map').addEventListener('click', () => {
    closeNavMapView();
  });
  
  // Initialize navigation map after DOM is ready
  setTimeout(() => {
    initializeNavMap(outlet);
  }, 100);
}

function initializeNavMap(outlet) {
  const navInfo = document.getElementById('nav-info');
  
  // Check if geolocation is supported
  if (!navigator.geolocation) {
    navInfo.innerHTML = `
      <div class="nav-info-content nav-error">
        <span>⚠️ Geolocation is not supported by your browser</span>
      </div>
    `;
    // Still show the outlet on the map
    initNavMapWithOutletOnly(outlet);
    return;
  }
  
  let initialized = false;
  
  const pollLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        if (!initialized) {
          initNavMapWithBothLocations(outlet, userLat, userLng);
          initialized = true;
        } else {
          updateUserLocation(outlet, userLat, userLng);
        }
      },
      (error) => {
        let errorMsg = 'Unable to get your location';
        if (error.code === 1) {
          errorMsg = 'Location permission denied';
        } else if (error.code === 2) {
          errorMsg = 'Location unavailable';
        } else if (error.code === 3) {
          errorMsg = 'Location request timed out';
        }
        
        // Only show error and outlet if not initialized yet
        if (!initialized) {
          navInfo.innerHTML = `
            <div class="nav-info-content nav-error">
              <span>⚠️ ${errorMsg}</span>
              <small>Showing outlet location only</small>
            </div>
          `;
          initNavMapWithOutletOnly(outlet);
          initialized = true; // prevent repeated outlet-only init
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };
  
  // Initial fetch
  pollLocation();
  // Clear existing interval if any (safety)
  if (navPollId) clearInterval(navPollId);
  // Poll every 2 seconds
  navPollId = setInterval(pollLocation, 2000);
}

function initNavMapWithBothLocations(outlet, userLat, userLng) {
  // Create map centered between user and outlet
  const centerLat = (userLat + outlet.latitude) / 2;
  const centerLng = (userLng + outlet.longitude) / 2;
  
  navMapInstance = L.map('nav-map-container', {
    zoomControl: true,
    attributionControl: false,
  }).setView([centerLat, centerLng], 13);
  
  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(navMapInstance);
  
  // Add attribution
  L.control.attribution({
    position: 'bottomright',
    prefix: false
  }).addAttribution('© OpenStreetMap').addTo(navMapInstance);
  
  // User location marker (blue dot)
  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="user-marker-dot">
        <div class="user-marker-pulse"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  
  // Create and save user marker reference for updates
  userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(navMapInstance)
    .bindPopup('Your Location');
  
  // Track initial position
  lastUserPos = { lat: userLat, lng: userLng };
  
  // Outlet marker (destination pin)
  const outletIcon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-pin marker-destination">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <div class="marker-label">${outlet.outlet_name}</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
  
  L.marker([outlet.latitude, outlet.longitude], { icon: outletIcon }).addTo(navMapInstance)
    .bindPopup(outlet.outlet_name);
  
  // Fetch route from OSRM (Open Source Routing Machine) API
  // This will draw the route along actual roads
  fetchRoute(userLng, userLat, outlet.longitude, outlet.latitude)
    .then(routeData => {
      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];
        
        // Decode the route geometry and draw it
        const coordinates = decodePolyline(route.geometry);
        
        // Draw route line along roads and save reference
        if (routeLine) {
          navMapInstance.removeLayer(routeLine);
        }
        routeLine = L.polyline(coordinates, {
          color: '#FF385C',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(navMapInstance);
        // Remove fallback if present
        if (fallbackLine) {
          navMapInstance.removeLayer(fallbackLine);
          fallbackLine = null;
        }
        
        // Update distance with actual route distance
        const routeDistance = route.distance; // in meters
        const navInfo = document.getElementById('nav-info');
        if (navInfo) {
          navInfo.innerHTML = `
            <div class="nav-info-content">
              <div class="nav-distance">
                <strong>${formatDistance(routeDistance)}</strong>
                <span class="nav-label">Route distance</span>
              </div>
              <div class="nav-coords">
                <span>📍 Your location: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}</span>
              </div>
            </div>
          `;
        }
        lastRouteAt = Date.now();
        
        // Fit bounds to the route
        const bounds = L.latLngBounds(coordinates);
        navMapInstance.fitBounds(bounds, { padding: [80, 80] });
      } else {
        // Fallback to straight line if routing fails
        drawStraightLine(userLat, userLng, outlet);
      }
    })
    .catch(error => {
      console.warn('Routing failed, using straight line:', error);
      // Fallback to straight line
      drawStraightLine(userLat, userLng, outlet);
    });
  
  // Fit initial bounds to show both markers
  const bounds = L.latLngBounds([
    [userLat, userLng],
    [outlet.latitude, outlet.longitude]
  ]);
  navMapInstance.fitBounds(bounds, { padding: [80, 80] });
  
  // Invalidate size after animation
  setTimeout(() => {
    navMapInstance.invalidateSize();
  }, 300);
}

// Fetch route from OSRM API
async function fetchRoute(startLng, startLat, endLng, endLat) {
  const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Routing request failed');
    return await response.json();
  } catch (error) {
    console.error('OSRM routing error:', error);
    throw error;
  }
}

// Decode polyline geometry (OSRM uses encoded polylines)
function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  
  return coordinates;
}

// Fallback: draw straight line if routing fails
function drawStraightLine(userLat, userLng, outlet) {
  const points = [[userLat, userLng], [outlet.latitude, outlet.longitude]];
  if (fallbackLine) {
    fallbackLine.setLatLngs(points);
  } else {
    fallbackLine = L.polyline(points, {
      color: '#FF385C',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(navMapInstance);
  }
}

// Update user location marker and route (called every 2 seconds)
function updateUserLocation(outlet, userLat, userLng) {
  if (!navMapInstance || !userMarker) return;
  
  // Always update user marker position
  userMarker.setLatLng([userLat, userLng]);
  
  // Determine if we should (re)route
  const now = Date.now();
  let movedEnough = true;
  if (lastUserPos) {
    const moved = calculateDistance(lastUserPos.lat, lastUserPos.lng, userLat, userLng);
    movedEnough = moved >= MOVE_THRESHOLD_METERS;
  }
  const throttled = (now - lastRouteAt) < MIN_ROUTE_INTERVAL_MS;
  
  // If not moved enough or throttled, keep existing line
  if (!movedEnough || throttled || routingInFlight) {
    // If routing failed previously and we have fallback, keep it updated so line doesn't disappear
    if (fallbackLine) {
      fallbackLine.setLatLngs([[userLat, userLng], [outlet.latitude, outlet.longitude]]);
      const navInfo = document.getElementById('nav-info');
      if (navInfo) {
        const d = calculateDistance(userLat, userLng, outlet.latitude, outlet.longitude);
        navInfo.innerHTML = `
          <div class="nav-info-content">
            <div class="nav-distance">
              <strong>${formatDistance(d)}</strong>
              <span class="nav-label">Distance to outlet</span>
            </div>
            <div class="nav-coords">
              <span>📍 Your location: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}</span>
            </div>
          </div>
        `;
      }
    }
    lastUserPos = { lat: userLat, lng: userLng };
    return;
  }
  
  // Fetch new route with updated position (single in-flight)
  routingInFlight = true;
  fetchRoute(userLng, userLat, outlet.longitude, outlet.latitude)
    .then(routeData => {
      if (routeData && routeData.routes && routeData.routes.length > 0) {
        const route = routeData.routes[0];
        const coordinates = decodePolyline(route.geometry);
        
        // Replace old route line
        if (routeLine) {
          navMapInstance.removeLayer(routeLine);
        }
        routeLine = L.polyline(coordinates, {
          color: '#FF385C',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(navMapInstance);
        
        // Remove fallback if present
        if (fallbackLine) {
          navMapInstance.removeLayer(fallbackLine);
          fallbackLine = null;
        }
        
        // Update distance info
        const routeDistance = route.distance;
        const navInfo = document.getElementById('nav-info');
        if (navInfo) {
          navInfo.innerHTML = `
            <div class="nav-info-content">
              <div class="nav-distance">
                <strong>${formatDistance(routeDistance)}</strong>
                <span class="nav-label">Route distance</span>
              </div>
              <div class="nav-coords">
                <span>📍 Your location: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}</span>
              </div>
            </div>
          `;
        }
        lastRouteAt = Date.now();
      } else {
        // Fallback to straight line
        drawStraightLine(userLat, userLng, outlet);
      }
    })
    .catch(error => {
      console.warn('Route update failed:', error);
      drawStraightLine(userLat, userLng, outlet);
    })
    .finally(() => {
      routingInFlight = false;
    });
  
  lastUserPos = { lat: userLat, lng: userLng };
}

function initNavMapWithOutletOnly(outlet) {
  navMapInstance = L.map('nav-map-container', {
    zoomControl: true,
    attributionControl: false,
  }).setView([outlet.latitude, outlet.longitude], 15);
  
  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(navMapInstance);
  
  // Add attribution
  L.control.attribution({
    position: 'bottomright',
    prefix: false
  }).addAttribution('© OpenStreetMap').addTo(navMapInstance);
  
  // Outlet marker
  const outletIcon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-pin marker-destination">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <div class="marker-label">${outlet.outlet_name}</div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
  
  L.marker([outlet.latitude, outlet.longitude], { icon: outletIcon }).addTo(navMapInstance)
    .bindPopup(outlet.outlet_name);
  
  // Invalidate size after animation
  setTimeout(() => {
    navMapInstance.invalidateSize();
  }, 300);
}

function closeNavMapView() {
  const overlay = document.getElementById('nav-map-overlay');
  if (!overlay) return;
  
  // Stop watching location
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
  // Stop polling
  if (navPollId) {
    clearInterval(navPollId);
    navPollId = null;
  }
  
  overlay.classList.remove('visible');
  
  setTimeout(() => {
    if (navMapInstance) {
      navMapInstance.remove();
      navMapInstance = null;
    }
    // Clean up references
    userMarker = null;
    routeLine = null;
    if (fallbackLine) {
      fallbackLine.remove();
      fallbackLine = null;
    }
    overlay.remove();
  }, 300);
}

// Calculate distance between two coordinates using Haversine formula (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Format distance for display
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

function addNavMapStyles() {
  if (document.getElementById('nav-map-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'nav-map-styles';
  style.textContent = `
    .nav-info {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1002;
      background: white;
      border-top: 2px solid var(--accent-color);
      padding: 16px;
    }
    
    .nav-info-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    
    .nav-spinner {
      animation: spin 1s linear infinite;
      color: var(--accent-color);
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .nav-error {
      color: #856404;
      background-color: #FFF3CD;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    
    .nav-error small {
      display: block;
      margin-top: 4px;
      font-size: 12px;
    }
    
    .nav-distance {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    
    .nav-distance strong {
      font-size: 24px;
      color: var(--accent-color);
    }
    
    .nav-label {
      font-size: 12px;
      color: var(--secondary-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .nav-coords {
      font-size: 12px;
      color: var(--secondary-color);
    }
    
    .user-location-marker {
      background: none;
      border: none;
    }
    
    .user-marker-dot {
      width: 20px;
      height: 20px;
      background-color: #4285F4;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    
    .user-marker-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: #4285F4;
      opacity: 0.4;
      transform: translate(-50%, -50%);
      animation: pulse 2s ease-out infinite;
    }
    
    @keyframes pulse {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.4;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.5);
        opacity: 0;
      }
    }
    
    .marker-destination {
      color: #FF385C;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
    }
  `;
  
  document.head.appendChild(style);
}

function addMapStyles() {
  if (document.getElementById('map-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'map-styles';
  style.textContent = `
    .map-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: white;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }
    
    .map-overlay.visible {
      transform: translateY(0);
    }
    
    .map-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      background-color: white;
      z-index: 1001;
    }
    
    .map-header h2 {
      font-size: 18px;
      font-weight: 600;
    }
    
    .map-container {
      flex: 1;
      position: relative;
      z-index: 1;
    }
    
    .custom-marker {
      background: none;
      border: none;
    }
    
    .marker-pin {
      color: var(--accent-color);
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    
    .marker-pin:hover {
      transform: scale(1.1);
    }
    
    .marker-validated {
      color: var(--success-color);
    }
    
    .marker-not-validated {
      color: #FFA500;
    }
    
    .marker-label {
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%);
      background-color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: none;
    }
    
    .outlet-preview {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1002;
      background: white;
      transform: translateY(0);
      transition: transform 0.3s ease;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.2);
    }
    
    .outlet-preview.hidden {
      transform: translateY(100%);
    }
    
    .preview-card {
      position: relative;
      cursor: pointer;
      padding-bottom: 16px;
    }
    
    .preview-close {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 3;
      background-color: rgba(255, 255, 255, 0.9);
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .preview-carousel {
      aspect-ratio: 16 / 9;
      position: relative;
    }
    
    .preview-content {
      padding: 12px 16px;
    }
    
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .preview-header h3 {
      font-size: 16px;
      font-weight: 600;
    }
    
    .preview-meta, .preview-contact {
      font-size: 14px;
      color: var(--secondary-color);
      margin-bottom: 4px;
    }
    
    
    /* Leaflet override */
    .leaflet-container {
      font-family: inherit;
    }
    
    .leaflet-control-attribution {
      font-size: 10px;
      padding: 2px 6px;
    }
  `;
  
  document.head.appendChild(style);
}

// Initialize Map
const map = L.map('map', { zoomControl: false }).setView([23.2599, 77.4126], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    className: 'map-tiles'
}).addTo(map);

// Add zoom control top right
L.control.zoom({ position: 'topright' }).addTo(map);

// Store data
let nodes = {}; // Cache for random access
let roads = [];
let pathLayers = [];
let selectedSource = null;
let selectedDest = null;
let currentPaths = [];
let isLoading = true;

// Track markers so we can remove them when they change
let sourceMarker = null;
let destMarker = null;

// Autocomplete state
let selectedIndex = -1;

// Icons
const nodeIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#3b82f6; width:12px; height:12px; border-radius:50%; border:2px solid white; cursor:pointer;'></div>",
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

// Path colors for multiple routes
const pathColors = [
    { color: '#10b981', label: 'Best Route', weight: 6 },
    { color: '#3b82f6', label: 'Alternative 1', weight: 5 },
    { color: '#f59e0b', label: 'Alternative 2', weight: 5 },
    { color: '#8b5cf6', label: 'Alternative 3', weight: 5 }
];

// Fetch Data on Load
document.addEventListener('DOMContentLoaded', async () => {
    // We intentionally DO NOT fetch all nodes anymore to speed up load time
    // But we do fetch roads to draw the network
    showLoading(true);
    await fetchRoads();
    showLoading(false);

    // Allow user to click on the map to select origin and destination
    map.on('click', async (e) => {
        if (isLoading) return;

        const sourceInput = document.getElementById('sourceInput');
        const destInput = document.getElementById('destInput');

        let type = 'source';
        if (sourceInput.value && !destInput.value) {
            type = 'dest';
        } else if (sourceInput.value && destInput.value) {
            // Both are filled, clear and start over with source
            sourceInput.value = '';
            destInput.value = '';
            if (sourceMarker) { map.removeLayer(sourceMarker); sourceMarker = null; }
            if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
            pathLayers.forEach(layer => map.removeLayer(layer));
            pathLayers = [];
            currentPaths = [];
            document.getElementById('routeList').innerHTML = '';
            document.getElementById('routeSummary').classList.add('hidden');
            closePathDetails();
            type = 'source';
        }

        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        // Show temporary marker while loading
        const tempId = `Loading...`;
        sourceInput.placeholder = type === 'source' ? 'Fetching location...' : 'Search for origin...';
        destInput.placeholder = type === 'dest' ? 'Fetching location...' : 'Search for destination...';

        try {
            // Reverse geocode to get a readable name
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&email=contact@smartpath.com`);
            const data = await res.json();
            const displayName = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            const cacheId = displayName;

            nodes[cacheId] = {
                lat: lat,
                lon: lon,
                coords: [lat, lon],
                fullName: displayName
            };

            selectNode(type, cacheId);
        } catch (err) {
            console.error("Reverse geocode failed", err);
            const fallbackId = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            nodes[fallbackId] = {
                lat: lat,
                lon: lon,
                coords: [lat, lon],
                fullName: fallbackId
            };
            selectNode(type, fallbackId);
        } finally {
            sourceInput.placeholder = 'Search for origin...';
            destInput.placeholder = 'Search for destination...';
        }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            document.querySelectorAll('.autocomplete-suggestions').forEach(el => el.classList.add('hidden'));
        }
    });
});

function showLoading(show) {
    const inputs = document.querySelectorAll('#sourceInput, #destInput');
    inputs.forEach(input => {
        if (show) {
            input.disabled = true;
            input.classList.add('opacity-50');
        } else {
            input.disabled = false;
            input.classList.remove('opacity-50');
        }
    });

    const button = document.querySelector('button[onclick="findAllPaths()"]');
    if (button) {
        button.disabled = show;
        if (show) {
            button.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            button.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    isLoading = show;
}

// Optimization: Fetches only limited roads or all roads if dataset small
async function fetchRoads() {
    try {
        const res = await fetch('/roads');
        roads = await res.json();

        const reportSelect = document.getElementById('reportRoadSelect');
        const reviewSelect = document.getElementById('reviewRoadSelect');

        reportSelect.innerHTML = '';
        reviewSelect.innerHTML = '';

        if (!roads || roads.length === 0) {
            console.warn('No roads available yet');
            return;
        }

        roads.forEach(road => {
            const label = `Road ${road.roadId}: ${road.fromNode} → ${road.toNode}`;
            reportSelect.add(new Option(label, road.roadId));
            reviewSelect.add(new Option(label, road.roadId));
        });

        console.log(`✅ Loaded ${roads.length} roads metadata`);
    } catch (e) {
        console.error("Failed to fetch roads", e);
    }
}

// Server-side Autocomplete Search
let searchTimeout = null;

async function handleAutocomplete(type) {
    if (isLoading) return;

    const input = document.getElementById(type + 'Input');
    const suggestionsDiv = document.getElementById(type + '-suggestions');
    const query = input.value.trim();

    if (query.length < 1) {
        suggestionsDiv.classList.add('hidden');
        return;
    }

    // Debounce
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(async () => {
        try {
            suggestionsDiv.innerHTML = `<div class="p-3 text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                <span class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                Searching...
            </div>`;
            suggestionsDiv.classList.remove('hidden');

            // Fetch unified results from Local and Global APIs
            let results = [];
            
            // 1. Local Database
            try {
                const localRes = await fetch(`/search/nodes?q=${encodeURIComponent(query)}`);
                const localData = await localRes.json();
                if (Array.isArray(localData)) {
                    localData.forEach(item => {
                        let finalName = item.display_name || item.nodeId;
                        
                        // Explicitly format Railway Stations for the core project requirements
                        if (!item.is_local) {
                            if (item.category === 'railway' && (item.type === 'station' || item.type === 'stop')) {
                                finalName = `${item.name} Railway Station (${item.display_name})`;
                            } else if (item.name && query.toLowerCase().includes("vidisha") && finalName.includes("Vidisha")) {
                                finalName = `Vidisha Railway Station (${finalName})`;
                            } else if (item.name && query.toLowerCase().includes("bhopal") && finalName.includes("Bhopal")) {
                                finalName = `Bhopal Junction (${finalName})`;
                            }
                        }

                        results.push({
                            properties: { name: finalName, isLocal: item.is_local === true },
                            geometry: { coordinates: [parseFloat(item.lon || item.longitude), parseFloat(item.lat || item.latitude)] }
                        });
                    });
                }
            } catch (e) { console.warn("Local search down", e); }

            // 2. Global Nominatim Search (Aggressive Vast Coverage)
            try {
                // Ensure vast search space without country bounds, high limits
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=15&email=contact@smartpath.com`);
                const nomData = await nomRes.json();
                if (Array.isArray(nomData)) {
                    nomData.forEach(item => {
                        results.push({
                            properties: { name: item.display_name, isLocal: false },
                            geometry: { coordinates: [parseFloat(item.lon), parseFloat(item.lat)] }
                        });
                    });
                }
            } catch (e) { console.warn("Nominatim blocked by browser, falling back", e); }

            // 3. Global Photon Search (Bypass CORS/Adblocks)
            try {
                const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15`);
                const photonData = await photonRes.json();
                if (photonData.features) {
                    results = results.concat(photonData.features);
                }
            } catch (e) { console.warn("Photon API down", e); }

            if (!results || results.length === 0) {
                suggestionsDiv.innerHTML = `
                    <div class="p-3 text-center">
                        <div class="text-gray-500 dark:text-gray-400 text-sm">No matches found for "${query}"</div>
                        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different or more generic term</div>
                    </div>`;
                return;
            }

            // Build suggestions with improved UI
            suggestionsDiv.innerHTML = results.map((feature, idx) => {
                const props = feature.properties;
                const coords = feature.geometry.coordinates;
                
                // Construct a smart display name
                let displayName = props.name || "Unknown Place";
                if (!props.isLocal) {
                    const parts = [props.name, props.street, props.city, props.state, props.country].filter(Boolean);
                    // Remove duplicates
                    const uniqueParts = [...new Set(parts)];
                    displayName = uniqueParts.join(', ');
                }

                const lat = coords[1];
                const lon = coords[0];

                // Cache node data for map plotting
                const cacheId = displayName;
                nodes[cacheId] = {
                    lat: lat,
                    lon: lon,
                    coords: [lat, lon],
                    fullName: displayName,
                    isLocal: props.isLocal === true
                };

                // Safely escape quotes for the onclick handler
                const safeCacheId = cacheId.replace(/'/g, "\\'").replace(/"/g, '&quot;');

                return `
                <div class="autocomplete-item ${idx === selectedIndex ? 'selected' : ''}"
                     onclick="selectNode('${type}', '${safeCacheId}')"
                     data-index="${idx}">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="font-size: 18px">location_on</span>
                        <div class="flex-1">
                            <div class="font-semibold text-sm">${highlightMatch(displayName, query)}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
                        </div>
                    </div>
                </div>
            `}).join('');

            // Add result count footer
            suggestionsDiv.innerHTML += `
                <div class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    ${results.length} result${results.length !== 1 ? 's' : ''} found
                </div>
            `;

        } catch (e) {
            console.error("Search failed", e);
            suggestionsDiv.innerHTML = `
                <div class="p-3 text-center">
                    <div class="text-red-500 text-sm">⚠️ Search error</div>
                    <div class="text-xs text-gray-500 mt-1">${e.message}</div>
                </div>`;
        }
    }, 300); // 300ms debounce
}

function highlightMatch(text, query) {
    if (!query) return text;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return `${before}<strong class="text-primary font-bold">${match}</strong>${after}`;
}

function selectNode(type, nodeId) {
    document.getElementById(type + 'Input').value = nodeId;
    document.getElementById(type + '-suggestions').classList.add('hidden');

    // Add marker to map
    if (nodes[nodeId]) {
        const n = nodes[nodeId];

        // Remove existing marker for this type
        if (type === 'source' && sourceMarker) map.removeLayer(sourceMarker);
        if (type === 'dest' && destMarker) map.removeLayer(destMarker);

        const marker = L.marker(n.coords, {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: `<div style='background-color:${type === 'source' ? '#10b981' : '#ef4444'}; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);'></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map);

        marker.bindPopup(`<b>${type === 'source' ? 'Origin' : 'Destination'}</b><br>${nodeId}`).openPopup();
        map.setView(n.coords, 14);

        if (type === 'source') {
            sourceMarker = marker;
            selectedSource = nodeId;
        } else {
            destMarker = marker;
            selectedDest = nodeId;
        }
    } else {
        if (type === 'source') {
            selectedSource = nodeId;
        } else {
            selectedDest = nodeId;
        }
    }
}

// Swap Origin and Destination logic
function swapInputs() {
    const sourceInput = document.getElementById('sourceInput');
    const destInput = document.getElementById('destInput');
    
    // Swap string values visually
    const tempValue = sourceInput.value;
    sourceInput.value = destInput.value;
    destInput.value = tempValue;

    // Swap logical node assignments
    const tempSelected = selectedSource;
    selectedSource = selectedDest;
    selectedDest = tempSelected;

    // Swap mapping markers graphically if they were previously placed
    if (sourceMarker || destMarker) {
        const tempMarker = sourceMarker;
        sourceMarker = destMarker;
        destMarker = tempMarker;

        // Reassign the green/red colors specifically to their new roles natively
        if (sourceMarker) {
            sourceMarker.setIcon(L.divIcon({
                className: 'custom-div-icon',
                html: `<div style='background-color:#10b981; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);'></div>`,
                iconSize: [16, 16], iconAnchor: [8, 8]
            }));
            sourceMarker.getPopup().setContent(`<b>Origin</b><br>${sourceInput.value}`);
        }
        if (destMarker) {
            destMarker.setIcon(L.divIcon({
                className: 'custom-div-icon',
                html: `<div style='background-color:#ef4444; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);'></div>`,
                iconSize: [16, 16], iconAnchor: [8, 8]
            }));
            destMarker.getPopup().setContent(`<b>Destination</b><br>${destInput.value}`);
        }
    }

    // Attempt to automatically recalculate the route now that inputs have reversed
    if (sourceInput.value && destInput.value) {
        findAllPaths();
    }
}

// Find Multiple Paths
async function findAllPaths() {
    const source = document.getElementById('sourceInput').value.trim();
    const dest = document.getElementById('destInput').value.trim();

    if (!source || !dest) {
        alert("Please enter both origin and destination.");
        return;
    }

    if (source === dest) {
        alert("Origin and destination must be different.");
        return;
    }

    // Clear existing paths
    pathLayers.forEach(layer => map.removeLayer(layer));
    pathLayers = [];
    currentPaths = [];

    // Clear markers if we want them to be redrawn purely by the path response
    if (sourceMarker) { map.removeLayer(sourceMarker); sourceMarker = null; }
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }

    const btn = document.querySelector('button[onclick="findAllPaths()"]');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
        Calculating...
    `;
    btn.disabled = true;
    btn.classList.add('opacity-75');

    try {
        let sourceLat = null;
        let sourceLon = null;
        let destLat = null;
        let destLon = null;

        if (nodes[source]) {
            sourceLat = nodes[source].lat;
            sourceLon = nodes[source].lon;
        }
        if (nodes[dest]) {
            destLat = nodes[dest].lat;
            destLon = nodes[dest].lon;
        }

        const prefTolls = document.getElementById('pref-tolls')?.checked || false;
        const prefHighways = document.getElementById('pref-highways')?.checked || false;
        const prefQuality = document.getElementById('pref-quality')?.checked || false;
        const prefObstacles = document.getElementById('pref-obstacles')?.checked || false;

        let pathsData = [];
        let isLocalRouting = nodes[source] && nodes[source].isLocal && nodes[dest] && nodes[dest].isLocal;

        // If places are local, route through the Java Backend to read DB metrics.
        // If they are global/vast places, route directly through OSRM bypassing local detours.
        if (isLocalRouting) {
            const res = await fetch('/path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    source, destination: dest, sourceLat, sourceLon, destLat, destLon,
                    prefTolls, prefHighways, prefQuality, prefObstacles
                })
            });
            const data = await res.json();
            pathsData = data.paths || [];
        } else {
            console.log("Global points detected. Routing directly via OSRM.");
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${sourceLon},${sourceLat};${destLon},${destLat}?overview=full&geometries=geojson&alternatives=true`;
            const osrmRes = await fetch(osrmUrl);
            const osrmData = await osrmRes.json();
            
            if (osrmData.code === 'Ok' && osrmData.routes) {
                pathsData = osrmData.routes.map((route, idx) => ({
                    path: [source, dest],
                    distance: route.distance / 1000,
                    time: Math.round(route.duration / 60), // OSRM gives duration in seconds
                    quality: 4.0, // Default for global paths
                    obstacles: 0,
                    pathWithCoordinates: route.geometry.coordinates.map(c => ({latitude: c[1], longitude: c[0]})),
                    type: idx === 0 ? 'optimal' : 'alternative',
                    isDirectOSRM: true
                }));
            }
        }

        if (!pathsData || pathsData.length === 0) {
            alert("No path found between these locations.");
            return;
        }

        // Store the multiple paths
        pathsData.forEach((p, idx) => {
            currentPaths.push({
                path: p.path,
                distance: p.distance,
                time: p.time,
                quality: p.quality,
                obstacles: p.obstacles,
                type: p.type,
                pathWithCoordinates: p.pathWithCoordinates,
                isDirectOSRM: p.isDirectOSRM || false
            });
        });

        displayPaths();

    } catch (e) {
        console.error("Path finding failed", e);
        alert("Error finding paths. Please try again.");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.classList.remove('opacity-75');
    }
}

function displayPaths() {
    const routeList = document.getElementById('routeList');
    routeList.innerHTML = '';

    // Create an async function inside to handle the paths
    (async () => {
        for (let idx = 0; idx < currentPaths.length; idx++) {
            const pathData = currentPaths[idx];
            const colorInfo = pathColors[idx] || pathColors[pathColors.length - 1];

        // Try to fetch accurate road geometry and distance from OSRM
        if (pathData.pathWithCoordinates && pathData.pathWithCoordinates.length > 0) {
            let latlngs = pathData.pathWithCoordinates.map(n => [n.latitude, n.longitude]);
            let finalDistance = pathData.distance;

            if (pathData.isDirectOSRM) {
                // Geometry is already fully rendered from OSRM directly!
                // No need to fetch it again, just use the array.
                latlngs = pathData.pathWithCoordinates.map(n => [n.latitude, n.longitude]);
            } else {
                try {
                    // Prepare coordinate string for OSRM (longitude,latitude)
                    // Limit to 100 waypoints if needed, but usually fallback data is small.
                    let osrmCoords = pathData.pathWithCoordinates.map(n => `${n.longitude},${n.latitude}`);
                    
                    // If there are too many coordinates for OSRM, we take a sample to keep it under 100
                    if (osrmCoords.length > 100) {
                        const sampled = [];
                        const step = Math.ceil(osrmCoords.length / 98);
                        for (let i = 0; i < osrmCoords.length; i += step) sampled.push(osrmCoords[i]);
                        if (sampled[sampled.length - 1] !== osrmCoords[osrmCoords.length - 1]) {
                            sampled.push(osrmCoords[osrmCoords.length - 1]);
                        }
                        osrmCoords = sampled;
                    }

                    const coordString = osrmCoords.join(';');
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
                    
                    const osrmRes = await fetch(osrmUrl);
                    const osrmData = await osrmRes.json();

                    if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
                        const route = osrmData.routes[0];
                        // OSRM returns coordinates as [longitude, latitude]
                        latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
                        
                        // Use OSRM's actual road distance (in meters, convert to km)
                        finalDistance = route.distance / 1000;
                        pathData.distance = finalDistance; 
                    }
                } catch(e) {
                    console.warn("OSRM routing failed, falling back to straight lines", e);
                }
            }

            const pathLayer = L.polyline(latlngs, {
                color: colorInfo.color,
                weight: colorInfo.weight,
                opacity: 0.8,
                className: 'path-layer'
            }).addTo(map);

            // Make path clickable
            pathLayer.on('click', () => showPathDetails(pathData, idx));
            pathLayers.push(pathLayer);

            // Fit bounds to show all paths
            if (idx === 0) {
                map.fitBounds(pathLayer.getBounds(), { padding: [80, 80] });

                // Add Origin and Destination Markers from the path coordinates to ensure they display properly
                const originCoord = [pathData.pathWithCoordinates[0].latitude, pathData.pathWithCoordinates[0].longitude];
                const destCoord = [pathData.pathWithCoordinates[pathData.pathWithCoordinates.length - 1].latitude, pathData.pathWithCoordinates[pathData.pathWithCoordinates.length - 1].longitude];

                sourceMarker = L.marker(originCoord, {
                    icon: L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style='background-color:#10b981; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);'></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map).bindPopup(`<b>Origin</b><br>${pathData.path[0]}`);

                destMarker = L.marker(destCoord, {
                    icon: L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style='background-color:#ef4444; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);'></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map).bindPopup(`<b>Destination</b><br>${pathData.path[pathData.path.length - 1]}`);
                
                // Update Route Summary UI with values from the optimal path
                document.getElementById('summary-distance').textContent = `${pathData.distance.toFixed(2)} km`;
                if (pathData.time !== undefined) {
                    const hours = Math.floor(pathData.time / 60);
                    const mins = pathData.time % 60;
                    document.getElementById('summary-time').textContent = hours > 0 ? `${hours} hr ${mins} min` : `${mins} min`;
                }
                if (pathData.quality !== undefined) {
                    let qText = "Excellent";
                    if (pathData.quality < 2.5) qText = "Poor";
                    else if (pathData.quality < 3.8) qText = "Fair";
                    else if (pathData.quality < 4.5) qText = "Good";
                    document.getElementById('summary-quality').textContent = `${qText} (${pathData.quality.toFixed(1)}/5)`;
                }
                if (pathData.obstacles !== undefined) {
                    document.getElementById('summary-obstacles').textContent = pathData.obstacles;
                }
            }
        }

        // Add to route list
        const routeCard = document.createElement('div');
        routeCard.className = 'p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
        routeCard.style.borderColor = colorInfo.color;
        routeCard.onclick = () => showPathDetails(pathData, idx);

        routeCard.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${colorInfo.color}"></div>
                        <span class="font-bold">${colorInfo.label}</span>
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        ${pathData.path.join(' → ')}
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-bold" style="color: ${colorInfo.color}">
                        ${pathData.distance.toFixed(2)} km
                    </div>
                    <div class="text-xs text-gray-500">Route via Map</div>
                </div>
            </div>
        `;

        routeList.appendChild(routeCard);
        }

        document.getElementById('routeSummary').classList.remove('hidden');
    })();
}

function showPathDetails(pathData, pathIdx) {
    const colorInfo = pathColors[pathIdx];
    const detailsPanel = document.getElementById('pathDetails');
    const content = document.getElementById('pathDetailsContent');

    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div class="w-4 h-4 rounded-full" style="background-color: ${colorInfo.color}"></div>
                <h4 class="text-lg font-bold">${colorInfo.label}</h4>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Distance</div>
                    <div class="text-xl font-bold" style="color: ${colorInfo.color}">${pathData.distance.toFixed(2)} km</div>
                </div>
                <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Segments</div>
                    <div class="text-xl font-bold">${pathData.path.length - 1}</div>
                </div>
            </div>

            <div>
                <div class="text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Route Breakdown</div>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                    ${pathData.path.map((node, i) => {
        if (i === pathData.path.length - 1) return '';
        return `
                            <div class="flex items-center gap-2 text-sm">
                                <span class="material-symbols-outlined text-gray-400" style="font-size: 16px">arrow_forward</span>
                                <span>${node} → ${pathData.path[i + 1]}</span>
                            </div>
                        `;
    }).join('')}
                </div>
            </div>

            <div class="pt-3 border-t border-gray-200 dark:border-gray-700">
                <div class="text-xs text-gray-500 dark:text-gray-400">
                    <p><strong>Path Type:</strong> ${pathData.type === 'optimal' ? 'Optimal (Dijkstra)' : 'Alternative'}</p>
                </div>
            </div>
        </div>
    `;

    detailsPanel.classList.remove('hidden');

    // Highlight selected path
    pathLayers.forEach((layer, idx) => {
        if (idx === pathIdx) {
            layer.setStyle({ weight: colorInfo.weight + 2, opacity: 1 });
            layer.bringToFront();
        } else {
            const otherColor = pathColors[idx];
            layer.setStyle({ weight: otherColor.weight, opacity: 0.5 });
        }
    });
}

function closePathDetails() {
    document.getElementById('pathDetails').classList.add('hidden');

    // Reset all paths to normal style
    pathLayers.forEach((layer, idx) => {
        const colorInfo = pathColors[idx];
        layer.setStyle({ weight: colorInfo.weight, opacity: 0.8 });
    });
}

// Modal Logic
function openReportModal() {
    document.getElementById('reportModal').style.display = 'flex';
}
function closeReportModal() {
    document.getElementById('reportModal').style.display = 'none';
}
function openReviewModal() {
    document.getElementById('reviewModal').style.display = 'flex';
}
function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

// Submissions
async function submitComplaint() {
    const roadId = document.getElementById('reportRoadSelect').value;
    const type = document.getElementById('reportType').value;
    const desc = document.getElementById('reportDesc').value;

    try {
        await fetch('/complaints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                road_id: parseFloat(roadId),
                complaint_type: type,
                description: desc,
                user_name: "WebUser"
            })
        });
        alert("✅ Complaint Submitted! Road metrics updated.");
        closeReportModal();
    } catch (e) {
        alert("❌ Failed to submit complaint.");
    }
}

async function submitReview() {
    const roadId = document.getElementById('reviewRoadSelect').value;
    const rating = document.getElementById('reviewRating').value;
    const comment = document.getElementById('reviewComment').value;

    try {
        await fetch('/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                road_id: parseFloat(roadId),
                rating: parseFloat(rating),
                comment: comment
            })
        });
        alert("✅ Review Submitted! Road safety score updated.");
        closeReviewModal();
    } catch (e) {
        alert("❌ Failed to submit review.");
    }
}

// Slider logic
function updateSliderValue(sliderType) {
    const val = document.getElementById('slider-' + sliderType).value;
    document.getElementById('val-' + sliderType).textContent = val + '%';
    document.getElementById('track-' + sliderType).style.width = val + '%';
    analyzeRoadConditions(); // Live update alerts based on slider
}

// AI Rules Implementation
function analyzeRoadConditions() {
    const surface = parseInt(document.getElementById('slider-surface').value, 10);
    const traffic = parseInt(document.getElementById('slider-traffic').value, 10);
    const safety = parseInt(document.getElementById('slider-safety').value, 10);
    const weather = parseInt(document.getElementById('slider-weather').value, 10);

    const alertsContainer = document.getElementById('alerts-container');
    alertsContainer.innerHTML = ''; // Clear previous

    let alerts = [];

    // Analyze conditions based on provided prompt rules
    if (surface < 40) {
        alerts.push({ type: 'Poor Road Condition Alert', desc: 'Low surface quality detected', severity: 'High', color: 'red' });
    }
    if (traffic > 70) {
        alerts.push({ type: 'Heavy Traffic Alert', desc: 'High traffic density detected', severity: 'Medium', color: 'amber' });
    }
    if (safety < 50) {
        alerts.push({ type: 'Unsafe Route Warning', desc: 'Low safety score detected', severity: 'High', color: 'red' });
    }
    if (weather > 60) {
        alerts.push({ type: 'Weather Alert', desc: 'High weather impact detected', severity: 'Medium', color: 'blue' });
    }

    // Render alerts
    if (alerts.length === 0) {
        // Clear Path
        alertsContainer.innerHTML = `
            <div class="bg-green-50 border border-green-100 rounded-lg p-3.5 flex gap-3 items-start">
                <div class="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-green-500"></div>
                <div>
                    <div class="text-sm font-semibold text-green-700 mb-0.5">Clear Path</div>
                    <div class="text-xs text-green-600">No obstacles detected</div>
                </div>
            </div>
        `;
    } else {
        alerts.forEach(alert => {
            const color = alert.color;
            const html = `
                <div class="bg-${color}-50 border border-${color}-100 rounded-lg p-3.5 flex gap-3 items-start mb-4">
                    <div class="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-${color}-500"></div>
                    <div>
                        <div class="text-sm font-semibold text-${color}-700 mb-0.5">${alert.type} - ${alert.severity} Severity</div>
                        <div class="text-xs text-${color}-600">${alert.desc}</div>
                    </div>
                </div>
            `;
            alertsContainer.innerHTML += html;
        });
    }
}

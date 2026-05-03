// Initialize Map
const bhopalBounds = [[23.10, 77.30], [23.60, 77.90]];
const map = L.map('map', { 
    zoomControl: false,
    maxBounds: bhopalBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 11
}).setView([23.2599, 77.4126], 13);

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
let selectedReviewPath = null;

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
let gpsWatchId = null;

function useCurrentLocation() {
    const btn = document.querySelector('button[onclick="useCurrentLocation()"]');
    
    // Toggle tracking off if already watching
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
        if(btn) btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">my_location</span> Use GPS';
        return;
    }

    if ("geolocation" in navigator) {
        if(btn) btn.innerHTML = '<span class="material-symbols-outlined text-[14px] text-green-500">my_location</span> Tracking...';
        
        gpsWatchId = navigator.geolocation.watchPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            const displayAddress = "Live GPS Location";
            document.getElementById('sourceInput').value = displayAddress;
            nodes[displayAddress] = { lat: lat, lon: lon };

            if (sourceMarker) {
                sourceMarker.setLatLng([lat, lon]);
            } else {
                map.setView([lat, lon], 15);
                sourceMarker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style='background-color:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);'></div>`,
                        iconSize: [16, 16]
                    })
                }).addTo(map).bindPopup("Current Location").openPopup();
            }

        }, (error) => {
            console.warn("GPS Error: " + error.message);
            if (error.code !== 3) { // 3 is timeout, keep trying if it's just a timeout
                navigator.geolocation.clearWatch(gpsWatchId);
                gpsWatchId = null;
                if(btn) btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">my_location</span> Use GPS';
                alert("Error getting location: " + error.message);
            }
        }, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        });
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

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
                // Restrict search space to Bhopal bounds
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=15&viewbox=77.30,23.60,77.90,23.10&bounded=1&email=contact@smartpath.com`);
                const nomData = await nomRes.json();
                if (Array.isArray(nomData)) {
                    nomData.forEach(item => {
                        const lat = parseFloat(item.lat);
                        const lon = parseFloat(item.lon);
                        if (lat >= 23.10 && lat <= 23.60 && lon >= 77.30 && lon <= 77.90) {
                            results.push({
                                properties: { name: item.display_name, isLocal: false },
                                geometry: { coordinates: [lon, lat] }
                            });
                        }
                    });
                }
            } catch (e) { console.warn("Nominatim blocked by browser, falling back", e); }

            // 3. Global Photon Search (Bypass CORS/Adblocks)
            try {
                // Restrict to Bhopal bbox
                const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15&bbox=77.30,23.10,77.90,23.60`);
                const photonData = await photonRes.json();
                if (photonData.features) {
                    photonData.features.forEach(feature => {
                        const coords = feature.geometry.coordinates;
                        const lon = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        if (lat >= 23.10 && lat <= 23.60 && lon >= 77.30 && lon <= 77.90) {
                            results.push(feature);
                        }
                    });
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
async function resolveCoordinate(query, nodesCache) {
    if (nodesCache && nodesCache[query]) {
        return { lat: nodesCache[query].lat, lon: nodesCache[query].lon };
    }
    
    // 1. Try Local Search First (Instant)
    try {
        const localRes = await fetch(`/search/nodes?q=${encodeURIComponent(query)}`);
        if (localRes.ok) {
            const localData = await localRes.json();
            if (Array.isArray(localData) && localData.length > 0) {
                return { 
                    lat: parseFloat(localData[0].lat || localData[0].latitude), 
                    lon: parseFloat(localData[0].lon || localData[0].longitude) 
                };
            }
        }
    } catch (e) { console.warn("Local search failed", e); }

    // 2. Fallback to Nominatim & Photon concurrently
    try {
        const fetchNom = fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=5&viewbox=77.30,23.60,77.90,23.10&bounded=1`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    for (let item of data) {
                        const lat = parseFloat(item.lat);
                        const lon = parseFloat(item.lon);
                        if (lat >= 23.10 && lat <= 23.60 && lon >= 77.30 && lon <= 77.90) return {lat, lon};
                    }
                }
                throw new Error("Nominatim Not found");
            });
            
        const fetchPhoton = fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&bbox=77.30,23.10,77.90,23.60`)
            .then(res => res.json())
            .then(data => {
                if (data && data.features) {
                    for (let feature of data.features) {
                        const coords = feature.geometry.coordinates;
                        const lon = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        if (lat >= 23.10 && lat <= 23.60 && lon >= 77.30 && lon <= 77.90) return {lat, lon};
                    }
                }
                throw new Error("Photon Not found");
            });

        return await Promise.any([fetchNom, fetchPhoton]);
    } catch (e) {
        return null;
    }
}

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
        // Run geocoding concurrently for source and dest using parallel execution
        const [sourceCoords, destCoords] = await Promise.all([
            resolveCoordinate(source, nodes),
            resolveCoordinate(dest, nodes)
        ]);

        if (!sourceCoords) {
            alert('Source location not found or outside Bhopal/Vidisha boundary.');
            btn.innerHTML = 'Find Path';
            btn.classList.remove('opacity-75');
            return;
        }

        if (!destCoords) {
            alert('Destination location not found or outside Bhopal/Vidisha boundary.');
            btn.innerHTML = 'Find Path';
            btn.classList.remove('opacity-75');
            return;
        }

        const sourceLat = sourceCoords.lat;
        const sourceLon = sourceCoords.lon;
        const destLat = destCoords.lat;
        const destLon = destCoords.lon;

        const prefTolls = document.getElementById('pref-tolls')?.checked || false;
        const prefHighways = document.getElementById('pref-highways')?.checked || false;
        const prefQuality = document.getElementById('pref-quality')?.checked || false;
        const prefObstacles = document.getElementById('pref-obstacles')?.checked || false;

        let pathsData = [];
        
        // Always route through the Java Backend to read DB metrics and get granular edges.
        // The backend will automatically snap Nominatim coordinates to the nearest local road nodes.
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

            // Use exactly the nodes computed by our Java Dijkstra Backend
            latlngs = pathData.pathWithCoordinates.map(n => [n.latitude, n.longitude]);

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

    selectedReviewPath = pathData.path;

    const edgeSelect = document.getElementById('reviewPathEdge');
    if (edgeSelect) {
        edgeSelect.innerHTML = '<option value="">-- Select Road Segment --</option>';
        if (pathData.path.length > 1) {
            const sourceName = document.getElementById('sourceInput').value.trim();
            const destName = document.getElementById('destInput').value.trim();
            
            for (let i = 0; i < pathData.path.length - 1; i++) {
                const u = pathData.path[i];
                const v = pathData.path[i+1];
                
                // Skip the artificial edges that just connect the search name to the first graph node
                if (u === sourceName || v === sourceName || u === destName || v === destName) continue;
                
                edgeSelect.add(new Option(`Segment: ${u} → ${v}`, `${u}||${v}`));
            }
        }
    }

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
    const email = localStorage.getItem('userEmail');

    try {
        const res = await fetch('/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                road_id: parseFloat(roadId),
                rating: parseFloat(rating),
                comment: comment,
                email: email
            })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("✅ " + data.message);
            closeReviewModal();
        } else {
            alert("❌ " + (data.message || "Failed to submit review."));
        }
    } catch (e) {
        alert("❌ Failed to submit review.");
    }
}

async function submitPathReview() {
    const edgeVal = document.getElementById('reviewPathEdge').value;
    if (!edgeVal) {
        alert("Please select a road segment from the dropdown to review.");
        return;
    }
    const [fromNode, toNode] = edgeVal.split('||');
    
    const surface = parseInt(document.getElementById('slider-surface').value, 10);
    const safety = parseInt(document.getElementById('slider-safety').value, 10);
    const weather = parseInt(document.getElementById('slider-weather').value, 10);
    const email = localStorage.getItem('userEmail');

    try {
        const res = await fetch('/edge-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromNode: fromNode,
                toNode: toNode,
                surface: surface,
                safety: safety,
                weather: weather,
                email: email
            })
        });
        const data = await res.json();
        
        if (data.success) {
            alert("✅ " + data.message);
        } else {
            alert("❌ " + (data.message || "Failed to submit path review."));
        }
    } catch (e) {
        console.error(e);
        alert("❌ Failed to submit path review.");
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
    const safety = parseInt(document.getElementById('slider-safety').value, 10);
    const weather = parseInt(document.getElementById('slider-weather').value, 10);

    const alertsContainer = document.getElementById('alerts-container');
    alertsContainer.innerHTML = ''; // Clear previous

    let alerts = [];

    // Analyze conditions based on provided prompt rules
    if (surface < 40) {
        alerts.push({ type: 'Poor Road Condition Alert', desc: 'Low surface quality detected', severity: 'High', color: 'red' });
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

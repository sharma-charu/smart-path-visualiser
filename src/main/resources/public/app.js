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

            const res = await fetch(`/search/nodes?q=${encodeURIComponent(query)}`);
            const results = await res.json();

            if (!results || results.length === 0) {
                suggestionsDiv.innerHTML = `
                    <div class="p-3 text-center">
                        <div class="text-gray-500 dark:text-gray-400 text-sm">No matches found for "${query}"</div>
                        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Try typing a node ID or number</div>
                    </div>`;
                return;
            }

            // Build suggestions with improved UI
            suggestionsDiv.innerHTML = results.map((node, idx) => {
                // Cache node data for map plotting
                nodes[node.nodeId] = {
                    lat: node.latitude,
                    lon: node.longitude,
                    coords: [node.latitude, node.longitude]
                };

                return `
                <div class="autocomplete-item ${idx === selectedIndex ? 'selected' : ''}"
                     onclick="selectNode('${type}', '${node.nodeId}')"
                     data-index="${idx}">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary" style="font-size: 18px">location_on</span>
                        <div class="flex-1">
                            <div class="font-semibold text-sm">${highlightMatch(node.nodeId, query)}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${node.latitude.toFixed(5)}, ${node.longitude.toFixed(5)}</div>
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
    }

    if (type === 'source') {
        selectedSource = nodeId;
    } else {
        selectedDest = nodeId;
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

    const btn = document.querySelector('button[onclick="findAllPaths()"]');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
        <span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
        Calculating...
    `;
    btn.disabled = true;
    btn.classList.add('opacity-75');

    try {
        // Get the optimal path
        const res = await fetch('/path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination: dest })
        });
        const optimalPath = await res.json();

        if (!optimalPath.path || optimalPath.path.length === 0) {
            alert("No path found between these locations.");
            return;
        }

        // Store the optimal path
        currentPaths.push({
            path: optimalPath.path,
            distance: optimalPath.distance,
            type: 'optimal',
            pathWithCoordinates: optimalPath.pathWithCoordinates
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

    currentPaths.forEach((pathData, idx) => {
        const colorInfo = pathColors[idx] || pathColors[pathColors.length - 1];

        // Draw path on map
        if (pathData.pathWithCoordinates && pathData.pathWithCoordinates.length > 0) {
            const latlngs = pathData.pathWithCoordinates.map(n => [n.latitude, n.longitude]);
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
                    <div class="text-xs text-gray-500">Click for details</div>
                </div>
            </div>
        `;

        routeList.appendChild(routeCard);
    });

    document.getElementById('routeSummary').classList.remove('hidden');
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

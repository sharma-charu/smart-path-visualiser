// Initialize Map
const map = L.map('map', { zoomControl: false }).setView([23.2599, 77.4126], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    className: 'map-tiles'
}).addTo(map);

// Add zoom control top right
L.control.zoom({ position: 'topright' }).addTo(map);

// Store data
let nodes = {};
let roads = [];
let routeLayer = null;

// Icons
const nodeIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#137fec; width:12px; height:12px; border-radius:50%; border:2px solid white;'></div>",
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

// Fetch Data on Load
document.addEventListener('DOMContentLoaded', async () => {
    await fetchNodes();
    await fetchRoads();
});

async function fetchNodes() {
    try {
        const res = await fetch('/nodes');
        const data = await res.json();
        const sourceSelect = document.getElementById('sourceSelect');
        const destSelect = document.getElementById('destSelect');

        sourceSelect.innerHTML = '';
        destSelect.innerHTML = '';

        data.forEach(node => {
            nodes[node.nodeId] = [node.latitude, node.longitude];

            // Add marker
            L.marker([node.latitude, node.longitude], { icon: nodeIcon })
                .addTo(map)
                .bindPopup(`Node ${node.nodeId}`);

            // Populate Dropdowns
            const option1 = new Option(`Node ${node.nodeId}`, node.nodeId);
            const option2 = new Option(`Node ${node.nodeId}`, node.nodeId);
            sourceSelect.add(option1);
            destSelect.add(option2);
        });

        // Set default selection if possible (A -> C)
        if (data.length > 2) {
            sourceSelect.value = "A";
            destSelect.value = "C";
        }

    } catch (e) {
        console.error("Failed to fetch nodes", e);
    }
}

async function fetchRoads() {
    try {
        const res = await fetch('/roads');
        roads = await res.json();

        const reportSelect = document.getElementById('reportRoadSelect');
        const reviewSelect = document.getElementById('reviewRoadSelect');

        reportSelect.innerHTML = '';
        reviewSelect.innerHTML = '';

        roads.forEach(road => {
            const label = `Road ${road.roadId}: ${road.fromNode} → ${road.toNode}`;
            const opt1 = new Option(label, road.roadId);
            const opt2 = new Option(label, road.roadId);

            reportSelect.add(opt1);
            reviewSelect.add(opt2);

            // Draw road line (neutral)
            if (nodes[road.fromNode] && nodes[road.toNode]) {
                L.polyline([nodes[road.fromNode], nodes[road.toNode]], { color: '#64748b', weight: 4, opacity: 0.4 }).addTo(map);
            }
        });
    } catch (e) {
        console.error("Failed to fetch roads", e);
    }
}

// Path Finding
async function findPath() {
    const source = document.getElementById('sourceSelect').value;
    const dest = document.getElementById('destSelect').value;

    if (source === dest) {
        alert("Source and Destination cannot be the same.");
        return;
    }

    try {
        const res = await fetch('/path', {
            method: 'POST',
            body: JSON.stringify({ source, destination: dest })
        });
        const data = await res.json();

        if (routeLayer) map.removeLayer(routeLayer);

        if (data.path && data.path.length > 1) {
            const latlngs = data.path.map(id => nodes[id]);
            // Draw Route
            routeLayer = L.polyline(latlngs, { color: '#10b981', weight: 6 }).addTo(map); // Green color for "Good"
            map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

            // Show Summary
            document.getElementById('routeSummary').classList.remove('hidden');
            document.getElementById('summaryDistance').innerText = data.distance + ' km';
            document.getElementById('summaryPath').innerText = data.path.join(" → ");
        } else {
            alert("No path found or unreachable.");
        }
    } catch (e) {
        console.error("Path finding failed", e);
        alert("Error finding path.");
    }
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
            body: JSON.stringify({
                road_id: parseFloat(roadId),
                complaint_type: type,
                description: desc,
                user_name: "MobileUser"
            })
        });
        alert("Complaint Submitted! Road metrics updated.");
        closeReportModal();
    } catch (e) {
        alert("Failed to submit.");
    }
}

async function submitReview() {
    const roadId = document.getElementById('reviewRoadSelect').value;
    const rating = document.getElementById('reviewRating').value;
    const comment = document.getElementById('reviewComment').value;

    try {
        await fetch('/reviews', {
            method: 'POST',
            body: JSON.stringify({
                road_id: parseFloat(roadId),
                rating: parseFloat(rating),
                comment: comment
            })
        });
        alert("Review Submitted! Road safety score updated.");
        closeReviewModal();
    } catch (e) {
        alert("Failed to submit.");
    }
}

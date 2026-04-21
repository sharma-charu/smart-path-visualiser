-- Database Schema for Smart Route Analyzer

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    trust_rating REAL DEFAULT 5.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Nodes Table (Map Points)
CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
);

-- 3. Roads Table (Edges)
CREATE TABLE IF NOT EXISTS roads (
    road_id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    distance REAL NOT NULL,
    FOREIGN KEY (from_node) REFERENCES nodes(node_id),
    FOREIGN KEY (to_node) REFERENCES nodes(node_id)
);

-- 4. Road Metrics Table (Dynamic Data)
CREATE TABLE IF NOT EXISTS road_metrics (
    road_id INTEGER PRIMARY KEY,
    surface_condition INTEGER DEFAULT 50 CHECK(surface_condition BETWEEN 0 AND 100),
    traffic_density INTEGER DEFAULT 50 CHECK(traffic_density BETWEEN 0 AND 100),
    safety_score INTEGER DEFAULT 50 CHECK(safety_score BETWEEN 0 AND 100),
    weather_impact INTEGER DEFAULT 50 CHECK(weather_impact BETWEEN 0 AND 100),
    obstacle_count INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (road_id) REFERENCES roads(road_id)
);

-- 5. Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
    complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
    road_id INTEGER NOT NULL,
    user_id INTEGER,
    complaint_type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'OPEN',
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (road_id) REFERENCES roads(road_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 6. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    road_id INTEGER NOT NULL,
    user_id INTEGER,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (road_id) REFERENCES roads(road_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- NOTE: OSMSeeder automatically populates nodes and roads from OpenStreetMap
-- For manual testing without OSM, uncomment the following lines:

-- INSERT INTO nodes (node_id, latitude, longitude) VALUES ('A', 23.2599, 77.4126) ON CONFLICT DO NOTHING;
-- INSERT INTO nodes (node_id, latitude, longitude) VALUES ('B', 23.2605, 77.4200) ON CONFLICT DO NOTHING;
-- INSERT INTO nodes (node_id, latitude, longitude) VALUES ('C', 23.2550, 77.4250) ON CONFLICT DO NOTHING;
-- INSERT INTO roads (from_node, to_node, distance) VALUES ('A', 'B', 3.0);
-- INSERT INTO roads (from_node, to_node, distance) VALUES ('B', 'C', 5.0);
-- INSERT INTO roads (from_node, to_node, distance) VALUES ('A', 'C', 9.0);

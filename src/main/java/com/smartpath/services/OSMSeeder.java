package com.smartpath.services;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.smartpath.db.DBConnection;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Map;

public class OSMSeeder {
    
    // Bhopal bounding box coordinates
    private static final double MIN_LAT = 23.18;
    private static final double MIN_LON = 77.35;
    private static final double MAX_LAT = 23.32;
    private static final double MAX_LON = 77.50;
    
    public static void seedFromOSM() {
        System.out.println("Starting OSM data seeding...");
        
        try {
            // Check if we already have data
            if (hasExistingData()) {
                System.out.println("Database already has data. Skipping OSM seeding.");
                return;
            }
            
            String overpassQuery = buildOverpassQuery();
            String osmData = fetchFromOverpass(overpassQuery);
            
            if (osmData != null && !osmData.isEmpty()) {
                parseAndInsertOSMData(osmData);
                System.out.println("OSM data seeding completed successfully!");
            } else {
                System.err.println("Failed to fetch OSM data. Using fallback data.");
                insertFallbackData();
            }
            
        } catch (Exception e) {
            System.err.println("Error during OSM seeding: " + e.getMessage());
            e.printStackTrace();
            insertFallbackData();
        }
    }
    
    private static boolean hasExistingData() {
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement("SELECT COUNT(*) FROM nodes")) {
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1) > 3; // More than the original mock data
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }
    
    private static String buildOverpassQuery() {
        // Query for roads (highways) in Bhopal area
        return String.format(
            "[out:json][timeout:60];" +
            "(" +
            "  way[\"highway\"][\"highway\"!~\"footway|path|steps|cycleway\"]" +
            "    (%.2f,%.2f,%.2f,%.2f);" +
            ");" +
            "(._;>;);" +
            "out body;",
            MIN_LAT, MIN_LON, MAX_LAT, MAX_LON
        );
    }
    
    private static String fetchFromOverpass(String query) {
        try {
            URL url = new URL("https://overpass-api.de/api/interpreter");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(60000);
            
            conn.getOutputStream().write(("data=" + java.net.URLEncoder.encode(query, "UTF-8")).getBytes());
            
            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) {
                    response.append(line);
                }
                in.close();
                return response.toString();
            } else {
                System.err.println("Overpass API returned error code: " + responseCode);
            }
        } catch (Exception e) {
            System.err.println("Error fetching from Overpass API: " + e.getMessage());
            e.printStackTrace();
        }
        return null;
    }
    
    private static void parseAndInsertOSMData(String jsonData) {
        try {
            JsonObject root = JsonParser.parseString(jsonData).getAsJsonObject();
            JsonArray elements = root.getAsJsonArray("elements");
            
            Map<Long, double[]> nodes = new HashMap<>();
            int roadCount = 0;
            int nodeCount = 0;
            
            Connection conn = DBConnection.getConnection();
            conn.setAutoCommit(false);
            
            // First pass: collect all nodes
            for (JsonElement elem : elements) {
                JsonObject obj = elem.getAsJsonObject();
                String type = obj.get("type").getAsString();
                
                if ("node".equals(type)) {
                    long id = obj.get("id").getAsLong();
                    double lat = obj.get("lat").getAsDouble();
                    double lon = obj.get("lon").getAsDouble();
                    nodes.put(id, new double[]{lat, lon});
                }
            }
            
            // Insert nodes
            PreparedStatement nodeStmt = conn.prepareStatement(
                "INSERT OR IGNORE INTO nodes (node_id, latitude, longitude) VALUES (?, ?, ?)"
            );
            
            for (Map.Entry<Long, double[]> entry : nodes.entrySet()) {
                nodeStmt.setString(1, String.valueOf(entry.getKey()));
                nodeStmt.setDouble(2, entry.getValue()[0]);
                nodeStmt.setDouble(3, entry.getValue()[1]);
                nodeStmt.addBatch();
                nodeCount++;
            }
            nodeStmt.executeBatch();
            
            // Second pass: process ways (roads)
            PreparedStatement roadStmt = conn.prepareStatement(
                "INSERT INTO roads (from_node, to_node, distance) VALUES (?, ?, ?)"
            );
            
            PreparedStatement metricsStmt = conn.prepareStatement(
                "INSERT OR IGNORE INTO road_metrics " +
                "(road_id, surface_condition, traffic_density, safety_score, weather_impact, obstacle_count) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            );
            
            for (JsonElement elem : elements) {
                JsonObject obj = elem.getAsJsonObject();
                String type = obj.get("type").getAsString();
                
                if ("way".equals(type) && obj.has("nodes")) {
                    JsonArray wayNodes = obj.getAsJsonArray("nodes");
                    
                    // Create edges between consecutive nodes
                    for (int i = 0; i < wayNodes.size() - 1; i++) {
                        long fromId = wayNodes.get(i).getAsLong();
                        long toId = wayNodes.get(i + 1).getAsLong();
                        
                        if (nodes.containsKey(fromId) && nodes.containsKey(toId)) {
                            double[] from = nodes.get(fromId);
                            double[] to = nodes.get(toId);
                            
                            // Calculate distance using Haversine formula
                            double distance = calculateDistance(from[0], from[1], to[0], to[1]);
                            
                            roadStmt.setString(1, String.valueOf(fromId));
                            roadStmt.setString(2, String.valueOf(toId));
                            roadStmt.setDouble(3, distance);
                            roadStmt.addBatch();
                            
                            roadCount++;
                            
                            // Limit the number of roads to prevent excessive data
                            if (roadCount >= 500) {
                                break;
                            }
                        }
                    }
                    
                    if (roadCount >= 500) break;
                }
            }
            
            roadStmt.executeBatch();
            
            // Initialize metrics for all roads with default values
            PreparedStatement getRoadsStmt = conn.prepareStatement("SELECT road_id FROM roads");
            ResultSet rs = getRoadsStmt.executeQuery();
            
            while (rs.next()) {
                int roadId = rs.getInt("road_id");
                metricsStmt.setInt(1, roadId);
                metricsStmt.setInt(2, 4); // surface_condition: good
                metricsStmt.setInt(3, 2); // traffic_density: low-medium
                metricsStmt.setInt(4, 4); // safety_score: good
                metricsStmt.setInt(5, 1); // weather_impact: minimal
                metricsStmt.setInt(6, 0); // obstacle_count: none
                metricsStmt.addBatch();
            }
            
            metricsStmt.executeBatch();
            conn.commit();
            conn.setAutoCommit(true);
            
            System.out.println("Inserted " + nodeCount + " nodes and " + roadCount + " roads from OSM data.");
            
            nodeStmt.close();
            roadStmt.close();
            metricsStmt.close();
            getRoadsStmt.close();
            conn.close();
            
        } catch (Exception e) {
            System.err.println("Error parsing OSM data: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        // Haversine formula for calculating distance between two points on Earth
        final int R = 6371; // Radius of Earth in kilometers
        
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c; // Distance in kilometers
    }
    
    private static void insertFallbackData() {
        System.out.println("Inserting enhanced fallback data...");
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            
            // Insert a more comprehensive set of nodes for Bhopal
            String[] nodeSql = {
                "INSERT OR IGNORE INTO nodes VALUES ('MP_NAGAR', 23.2327, 77.4316)",
                "INSERT OR IGNORE INTO nodes VALUES ('NEW_MARKET', 23.2599, 77.4126)",
                "INSERT OR IGNORE INTO nodes VALUES ('HAMIDIA_ROAD', 23.2685, 77.4025)",
                "INSERT OR IGNORE INTO nodes VALUES ('TT_NAGAR', 23.2415, 77.4025)",
                "INSERT OR IGNORE INTO nodes VALUES ('KOLAR_ROAD', 23.1825, 77.4304)",
                "INSERT OR IGNORE INTO nodes VALUES ('BAIRAGARH', 23.2600, 77.3400)",
                "INSERT OR IGNORE INTO nodes VALUES ('HABIBGANJ', 23.2280, 77.4386)",
                "INSERT OR IGNORE INTO nodes VALUES ('BHOPAL_JN', 23.2699, 77.4120)",
                "INSERT OR IGNORE INTO nodes VALUES ('ARERA_COLONY', 23.2156, 77.4304)",
                "INSERT OR IGNORE INTO nodes VALUES ('SHAHPURA', 23.1958, 77.4586)"
            };
            
            PreparedStatement stmt = conn.createStatement() instanceof PreparedStatement ? 
                (PreparedStatement) conn.createStatement() : null;
            
            for (String sql : nodeSql) {
                conn.createStatement().execute(sql);
            }
            
            // Insert roads with realistic distances
            String[] roadSql = {
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('MP_NAGAR', 'NEW_MARKET', 3.2)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('NEW_MARKET', 'HAMIDIA_ROAD', 1.8)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('MP_NAGAR', 'TT_NAGAR', 2.5)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('TT_NAGAR', 'KOLAR_ROAD', 7.3)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('NEW_MARKET', 'BHOPAL_JN', 1.2)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('HAMIDIA_ROAD', 'BHOPAL_JN', 2.0)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('MP_NAGAR', 'BAIRAGARH', 8.1)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('MP_NAGAR', 'HABIBGANJ', 2.8)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('TT_NAGAR', 'ARERA_COLONY', 3.5)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('ARERA_COLONY', 'SHAHPURA', 4.2)",
                "INSERT INTO roads (from_node, to_node, distance) VALUES ('HABIBGANJ', 'KOLAR_ROAD', 5.8)"
            };
            
            for (String sql : roadSql) {
                conn.createStatement().execute(sql);
            }
            
            // Initialize metrics
            PreparedStatement metricsStmt = conn.prepareStatement(
                "INSERT OR IGNORE INTO road_metrics " +
                "(road_id, surface_condition, traffic_density, safety_score, weather_impact, obstacle_count) " +
                "SELECT road_id, 4, 2, 4, 1, 0 FROM roads"
            );
            metricsStmt.execute();
            
            conn.commit();
            conn.setAutoCommit(true);
            
            System.out.println("Fallback data inserted successfully.");
            
        } catch (Exception e) {
            System.err.println("Error inserting fallback data: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

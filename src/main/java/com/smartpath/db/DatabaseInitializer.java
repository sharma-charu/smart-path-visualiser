package com.smartpath.db;

import java.sql.Connection;
import java.sql.Statement;

public class DatabaseInitializer {

    public static void initialize() {
        System.out.println("==================================================");
        System.out.println("🚀 Starting Database Initialization...");
        System.out.println("==================================================");
        
        try (Connection conn = DBConnection.getConnection()) {
            if (conn == null) {
                System.err.println("❌ CRITICAL: Failed to establish database connection!");
                return;
            }
            
            System.out.println("✅ Database connection established");
            
            Statement stmt = conn.createStatement();
            
            // Create tables programmatically (avoid SQL file parsing issues)
            System.out.println("Creating database schema...");
            
            // 1. Users Table
            stmt.execute("CREATE TABLE IF NOT EXISTS users (" +
                "user_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "name TEXT NOT NULL," +
                "email TEXT," +
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
            System.out.println("  ✓ Created table: users");
            
            // 2. Nodes Table
            stmt.execute("CREATE TABLE IF NOT EXISTS nodes (" +
                "node_id TEXT PRIMARY KEY," +
                "latitude REAL NOT NULL," +
                "longitude REAL NOT NULL)");
            System.out.println("  ✓ Created table: nodes");
            
            // 3. Roads Table
            stmt.execute("CREATE TABLE IF NOT EXISTS roads (" +
                "road_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "from_node TEXT NOT NULL," +
                "to_node TEXT NOT NULL," +
                "distance REAL NOT NULL," +
                "FOREIGN KEY (from_node) REFERENCES nodes(node_id)," +
                "FOREIGN KEY (to_node) REFERENCES nodes(node_id))");
            System.out.println("  ✓ Created table: roads");
            
            // 4. Road Metrics Table
            stmt.execute("CREATE TABLE IF NOT EXISTS road_metrics (" +
                "road_id INTEGER PRIMARY KEY," +
                "surface_condition INTEGER CHECK(surface_condition BETWEEN 1 AND 5)," +
                "traffic_density INTEGER CHECK(traffic_density BETWEEN 1 AND 5)," +
                "safety_score INTEGER CHECK(safety_score BETWEEN 1 AND 5)," +
                "weather_impact INTEGER CHECK(weather_impact BETWEEN 1 AND 5)," +
                "obstacle_count INTEGER DEFAULT 0," +
                "last_updated DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "FOREIGN KEY (road_id) REFERENCES roads(road_id))");
            System.out.println("  ✓ Created table: road_metrics");
            
            // 5. Complaints Table
            stmt.execute("CREATE TABLE IF NOT EXISTS complaints (" +
                "complaint_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "road_id INTEGER NOT NULL," +
                "user_id INTEGER," +
                "complaint_type TEXT NOT NULL," +
                "description TEXT," +
                "status TEXT DEFAULT 'OPEN'," +
                "reported_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "FOREIGN KEY (road_id) REFERENCES roads(road_id)," +
                "FOREIGN KEY (user_id) REFERENCES users(user_id))");
            System.out.println("  ✓ Created table: complaints");
            
            // 6. Reviews Table
            stmt.execute("CREATE TABLE IF NOT EXISTS reviews (" +
                "review_id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "road_id INTEGER NOT NULL," +
                "user_id INTEGER," +
                "rating INTEGER CHECK(rating BETWEEN 1 AND 5)," +
                "comment TEXT," +
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP," +
                "FOREIGN KEY (road_id) REFERENCES roads(road_id)," +
                "FOREIGN KEY (user_id) REFERENCES users(user_id))");
            System.out.println("  ✓ Created table: reviews");
            
            stmt.close();
            
            System.out.println("✅ Schema creation completed");
            System.out.println("==================================================");
            
            // Seed with data in a background thread to allow server to start immediately
            new Thread(() -> {
                System.out.println("Starting data seeding in background...");
                try {
                    com.smartpath.services.OSMSeeder.seedFromOSM();
                    System.out.println("==================================================");
                    System.out.println("✅ Background data seeding complete!");
                    System.out.println("==================================================");
                } catch (Exception e) {
                    System.err.println("❌ Background seeding failed: " + e.getMessage());
                    e.printStackTrace();
                }
            }).start();
            
            System.out.println("✅ Database initialization logic started");
            System.out.println("==================================================");
            
        } catch (Exception e) {
            System.err.println("❌ CRITICAL ERROR during database initialization:");
            e.printStackTrace();
        }
    }
    
    public static void main(String[] args) {
        initialize();
    }
}

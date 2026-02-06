package com.smartpath;

import static spark.Spark.*;

public class MainServer {
    public static void main(String[] args) {
        // Initialize Database
        com.smartpath.db.DatabaseInitializer.initialize();

        // Set the port
        port(8081);

        // Serve static files from src/main/resources/public
        staticFiles.location("/public"); 

        // Enable CORS
        options("/*", (req, res) -> {
            String accessControlRequestHeaders = req.headers("Access-Control-Request-Headers");
            if (accessControlRequestHeaders != null) {
                res.header("Access-Control-Allow-Headers", accessControlRequestHeaders);
            }

            String accessControlRequestMethod = req.headers("Access-Control-Request-Method");
            if (accessControlRequestMethod != null) {
                res.header("Access-Control-Allow-Methods", accessControlRequestMethod);
            }

            return "OK";
        });

        before((req, res) -> res.header("Access-Control-Allow-Origin", "*"));

        // Register routes
        com.smartpath.routes.MetaRoutes.register();
        com.smartpath.routes.PathRoutes.register();
        com.smartpath.routes.ComplaintRoutes.register();
        com.smartpath.routes.ReviewRoutes.register();

        // Test Endpoint
        get("/hello", (req, res) -> "Smart Route Analyzer Backend is Running!");

        System.out.println("==============================================");
        System.out.println("🚀 Smart Route Analyzer Server Started!");
        System.out.println("==============================================");
        System.out.println("📍 Server running at: http://localhost:8081");
        System.out.println("🗺️  Open UI at: http://localhost:8081/index.html");
        System.out.println("🔧 API: http://localhost:8081/hello");
        System.out.println("==============================================");
    }
}

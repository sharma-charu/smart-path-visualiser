package com.smartpath.db;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.Statement;

public class DatabaseInitializer {

    public static void initialize() {
        String schemaPath = "database/schema.sql";
        
        try (Connection conn = DBConnection.getConnection()) {
            if (conn != null) {
                String sql = new String(Files.readAllBytes(Paths.get(schemaPath)));
                // Split by semicolon vs executing whole script depends on driver support.
                // SQLite driver usually supports executing script if using the right method,
                // but standard Statement.executeUpdate executes one SQL statement.
                // We'll split simply.
                
                // Remove comments roughly to avoid split errors (basic regex)
                // This is a simple splitter, might need robustness for complex SQL
                String[] statements = sql.split(";");
                
                Statement stmt = conn.createStatement();
                for (String s : statements) {
                    if (!s.trim().isEmpty()) {
                        stmt.execute(s.trim());
                    }
                }
                System.out.println("Database initialized successfully.");
            } else {
                System.err.println("Failed to connect to database for initialization.");
            }
        } catch (IOException | java.sql.SQLException e) {
            e.printStackTrace();
        }
    }
    
    public static void main(String[] args) {
        initialize();
    }
}

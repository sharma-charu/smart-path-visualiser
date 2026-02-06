package com.smartpath.db;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {
    // Check if running from within the project root or elsewhere might require adjustment,
    // but relative path usually works if run from project root.
    private static final String URL = "jdbc:sqlite:database/smart_route.db";

    public static Connection getConnection() {
        try {
            // Load the JDBC driver explicitly (sometimes needed for shade plugins or older envs)
            Class.forName("org.sqlite.JDBC");
            return DriverManager.getConnection(URL);
        } catch (ClassNotFoundException | SQLException e) {
            e.printStackTrace();
            return null;
        }
    }
}

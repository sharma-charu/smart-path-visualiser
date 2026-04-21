package com.smartpath.services;

import com.smartpath.db.DBConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.Map;

public class AuthService {

    public static boolean signupUser(String name, String email, String password) {
        String sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, name);
            pstmt.setString(2, email);
            pstmt.setString(3, password);
            int affected = pstmt.executeUpdate();
            return affected > 0;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    public static Map<String, Object> loginUser(String email, String password) {
        String sql = "SELECT name, trust_rating FROM users WHERE email = ? AND password = ?";
        Map<String, Object> result = new HashMap<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, email);
            pstmt.setString(2, password);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                result.put("success", true);
                result.put("name", rs.getString("name"));
                result.put("trust_rating", rs.getDouble("trust_rating"));
                return result;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        result.put("success", false);
        return result;
    }

    public static double getUserTrustRating(String email) {
        String sql = "SELECT trust_rating FROM users WHERE email = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, email);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getDouble("trust_rating");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return 5.0; // Default fallback if missing
    }

    public static Integer getUserId(String email) {
        String sql = "SELECT user_id FROM users WHERE email = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setString(1, email);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                return rs.getInt("user_id");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}

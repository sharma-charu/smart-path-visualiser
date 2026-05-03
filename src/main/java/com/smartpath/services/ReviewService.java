package com.smartpath.services;

import com.smartpath.db.DBConnection;
import com.smartpath.models.Review;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

public class ReviewService {

    public static boolean addReview(int roadId, int rating, String comment, String email) {
        Integer userId = null;
        if (email != null && !email.isEmpty()) {
            double trustRating = AuthService.getUserTrustRating(email);
            if (trustRating < 2.5) {
                return false; // Reject review data
            }
            userId = AuthService.getUserId(email);
        }

        String sql = "INSERT INTO reviews (road_id, rating, comment, user_id) VALUES (?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, roadId);
            pstmt.setInt(2, rating);
            pstmt.setString(3, comment);
            if (userId != null) {
                pstmt.setInt(4, userId);
            } else {
                pstmt.setNull(4, java.sql.Types.INTEGER);
            }
            
            int affected = pstmt.executeUpdate();
            
            if (affected > 0) {
                recalculateRoadScores(conn, roadId);
                RoadService.clearCache();
                return true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    private static void recalculateRoadScores(Connection conn, int roadId) {
        // Recalculate average rating and update metrics
        String avgSql = "SELECT AVG(rating) as avg_rating FROM reviews WHERE road_id = ?";
        try (PreparedStatement pstmt = conn.prepareStatement(avgSql)) {
            pstmt.setInt(1, roadId);
            ResultSet rs = pstmt.executeQuery();
            if (rs.next()) {
                double avg = rs.getDouble("avg_rating");
                // Update safety_score to match avg rating (rounded)
                int newScore = (int) Math.round(avg);
                String updateSql = "UPDATE road_metrics SET safety_score = ? WHERE road_id = ?";
                try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                    updateStmt.setInt(1, newScore);
                    updateStmt.setInt(2, roadId);
                    updateStmt.executeUpdate();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static List<Review> getReviewsForRoad(int roadId) {
        List<Review> list = new ArrayList<>();
        String sql = "SELECT * FROM reviews WHERE road_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, roadId);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                list.add(new Review(
                    rs.getInt("review_id"),
                    rs.getInt("road_id"),
                    "Anonymous",
                    rs.getInt("rating"),
                    rs.getString("comment"),
                    rs.getString("created_at")
                ));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }

    public static boolean addPathReview(List<String> path, int surfaceCondition, int safetyScore, int weatherImpact, String email) {
        Integer userId = null;
        if (email != null && !email.isEmpty()) {
            double trustRating = AuthService.getUserTrustRating(email);
            if (trustRating < 2.5) {
                return false; // Reject review data
            }
            userId = AuthService.getUserId(email);
        }

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            
            // Find road_id for each pair of consecutive nodes
            String findRoadSql = "SELECT road_id FROM roads WHERE (from_node = ? AND to_node = ?) OR (from_node = ? AND to_node = ?)";
            PreparedStatement findRoadStmt = conn.prepareStatement(findRoadSql);
            
            String updateMetricsSql = "UPDATE road_metrics SET surface_condition = (surface_condition + ?)/2, safety_score = (safety_score + ?)/2, weather_impact = (weather_impact + ?)/2 WHERE road_id = ?";
            PreparedStatement updateMetricsStmt = conn.prepareStatement(updateMetricsSql);
            
            for (int i = 0; i < path.size() - 1; i++) {
                String u = path.get(i);
                String v = path.get(i + 1);
                
                findRoadStmt.setString(1, u);
                findRoadStmt.setString(2, v);
                findRoadStmt.setString(3, v);
                findRoadStmt.setString(4, u);
                
                ResultSet rs = findRoadStmt.executeQuery();
                if (rs.next()) {
                    int roadId = rs.getInt("road_id");
                    
                    updateMetricsStmt.setInt(1, surfaceCondition);
                    updateMetricsStmt.setInt(2, safetyScore);
                    updateMetricsStmt.setInt(3, weatherImpact);
                    updateMetricsStmt.setInt(4, roadId);
                    updateMetricsStmt.addBatch();
                }
            }
            
            updateMetricsStmt.executeBatch();
            conn.commit();
            RoadService.clearCache();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    public static boolean addEdgeReview(String fromNode, String toNode, int surfaceCondition, int safetyScore, int weatherImpact, String email) {
        Integer userId = null;
        if (email != null && !email.isEmpty()) {
            double trustRating = AuthService.getUserTrustRating(email);
            if (trustRating < 2.5) {
                return false; // Reject review data
            }
            userId = AuthService.getUserId(email);
        }

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            
            String findRoadSql = "SELECT road_id FROM roads WHERE (from_node = ? AND to_node = ?) OR (from_node = ? AND to_node = ?)";
            PreparedStatement findRoadStmt = conn.prepareStatement(findRoadSql);
            findRoadStmt.setString(1, fromNode);
            findRoadStmt.setString(2, toNode);
            findRoadStmt.setString(3, toNode);
            findRoadStmt.setString(4, fromNode);
            
            ResultSet rs = findRoadStmt.executeQuery();
            if (rs.next()) {
                int roadId = rs.getInt("road_id");
                
                String updateMetricsSql = "UPDATE road_metrics SET surface_condition = (surface_condition + ?)/2, safety_score = (safety_score + ?)/2, weather_impact = (weather_impact + ?)/2 WHERE road_id = ?";
                PreparedStatement updateMetricsStmt = conn.prepareStatement(updateMetricsSql);
                updateMetricsStmt.setInt(1, surfaceCondition);
                updateMetricsStmt.setInt(2, safetyScore);
                updateMetricsStmt.setInt(3, weatherImpact);
                updateMetricsStmt.setInt(4, roadId);
                
                updateMetricsStmt.executeUpdate();
                conn.commit();
                RoadService.clearCache();
                return true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }
}

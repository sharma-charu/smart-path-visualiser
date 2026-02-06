package com.smartpath.services;

import com.smartpath.db.DBConnection;
import com.smartpath.models.Review;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

public class ReviewService {

    public static boolean addReview(int roadId, int rating, String comment) {
        String sql = "INSERT INTO reviews (road_id, rating, comment) VALUES (?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, roadId);
            pstmt.setInt(2, rating);
            pstmt.setString(3, comment);
            int affected = pstmt.executeUpdate();
            
            if (affected > 0) {
                recalculateRoadScores(conn, roadId);
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
}

package com.smartpath.services;

import com.smartpath.db.DBConnection;
import com.smartpath.models.Complaint;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

public class ComplaintService {

    public static boolean addComplaint(int roadId, String userName, String type, String desc) {
        String sql = "INSERT INTO complaints (road_id, user_id, complaint_type, description, status) VALUES (?, (SELECT user_id FROM users WHERE name = ?), ?, ?, 'OPEN')"; 
        // Note: For now assuming user might exist or we handle user creation separately. 
        // Simplified: insert name directly if we change schema or just use dummy user_id if null.
        // Actually schema has user_id. Let's simplify: Just store user_id as 1 or NULL for now, or assume logical user handling.
        // Better: Change schema to store reported_by name directly for simplicity? 
        // The previously created schema has user_id foreign key. 
        // To be safe and simple, let's insert into `users` if not exists or just handle the complaint insert carefully.
        // For MVP, let's just insert with user_id=NULL if we don't have login, or fetch.
        
        // Re-reading schema: `user_id` in complaints is nullable.
        
        String insertSql = "INSERT INTO complaints (road_id, complaint_type, description) VALUES (?, ?, ?)";
        
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(insertSql)) {
            pstmt.setInt(1, roadId);
            pstmt.setString(2, type);
            pstmt.setString(3, desc);
            int affected = pstmt.executeUpdate();
            
            if (affected > 0) {
                updateRoadMetrics(conn, roadId, type);
                RoadService.clearCache();
                return true;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }

    private static void updateRoadMetrics(Connection conn, int roadId, String type) {
        // Simple logic: If complaint, increase obstacle count or decrease scores
        // This should match the logic defined in docs.
        try {
            String updateSql = "UPDATE road_metrics SET obstacle_count = obstacle_count + 1, safety_score = MAX(1, safety_score - 1), surface_condition = MAX(1, surface_condition - 1) WHERE road_id = ?";
            try (PreparedStatement pstmt = conn.prepareStatement(updateSql)) {
                 pstmt.setInt(1, roadId);
                 pstmt.executeUpdate();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static List<Complaint> getComplaintsForRoad(int roadId) {
        List<Complaint> list = new ArrayList<>();
        String sql = "SELECT * FROM complaints WHERE road_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {
            pstmt.setInt(1, roadId);
            ResultSet rs = pstmt.executeQuery();
            while (rs.next()) {
                list.add(new Complaint(
                    rs.getInt("complaint_id"),
                    rs.getInt("road_id"),
                    "Anonymous", // Placeholder
                    rs.getString("complaint_type"),
                    rs.getString("description"),
                    rs.getString("status"),
                    rs.getString("reported_at")
                ));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }
}

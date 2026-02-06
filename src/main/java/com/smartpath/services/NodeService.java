package com.smartpath.services;

import com.smartpath.db.DBConnection;
import com.smartpath.models.Node;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

public class NodeService {

    public static List<Node> getAllNodes() {
        List<Node> list = new ArrayList<>();
        String sql = "SELECT * FROM nodes";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql);
             ResultSet rs = pstmt.executeQuery()) {
            
            while (rs.next()) {
                list.add(new Node(
                    rs.getString("node_id"),
                    rs.getDouble("latitude"),
                    rs.getDouble("longitude")
                ));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return list;
    }
}

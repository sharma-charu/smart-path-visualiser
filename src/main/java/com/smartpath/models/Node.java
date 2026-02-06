package com.smartpath.models;

public class Node {
    private String nodeId;
    private double latitude;
    private double longitude;

    public Node(String nodeId, double latitude, double longitude) {
        this.nodeId = nodeId;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getNodeId() { return nodeId; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
}

package com.smartpath.models;

public class Road {
    private int roadId;
    private String fromNode;
    private String toNode;
    private double distance;

    public Road(int roadId, String fromNode, String toNode, double distance) {
        this.roadId = roadId;
        this.fromNode = fromNode;
        this.toNode = toNode;
        this.distance = distance;
    }

    public int getRoadId() { return roadId; }
    public String getFromNode() { return fromNode; }
    public String getToNode() { return toNode; }
    public double getDistance() { return distance; }
}

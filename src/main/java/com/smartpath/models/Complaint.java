package com.smartpath.models;

public class Complaint {
    private int complaintId;
    private int roadId;
    private String userName;
    private String complaintType;
    private String description;
    private String status;
    private String reportedAt;

    public Complaint(int complaintId, int roadId, String userName, String complaintType, String description, String status, String reportedAt) {
        this.complaintId = complaintId;
        this.roadId = roadId;
        this.userName = userName;
        this.complaintType = complaintType;
        this.description = description;
        this.status = status;
        this.reportedAt = reportedAt;
    }

    // Getters
    public int getComplaintId() { return complaintId; }
    public int getRoadId() { return roadId; }
}

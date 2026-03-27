const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: {
        type: String,
        required: true,
        unique: true
    },
    squad1: {
        name: String,
        captainId: String,
        members: [String],
        score: Number
    },
    squad2: {
        name: String,
        captainId: String,
        members: [String],
        score: Number
    },
    winner: {
        type: String,
        default: null
    },
    screenshots: [String],
    submittedBy: {
        userId: String,
        username: String
    },
    verifiedBy: {
        userId: String,
        username: String,
        timestamp: Date
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    tournament: {
        type: String,
        default: null
    },
    matchDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Match', matchSchema);
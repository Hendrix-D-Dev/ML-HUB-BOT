const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true
    },
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['complaint', 'suggestion', 'support'],
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'closed', 'resolved'],
        default: 'open'
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    messages: [{
        userId: String,
        username: String,
        content: String,
        timestamp: Date,
        attachments: [String]
    }],
    claimedBy: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    closedAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('Ticket', ticketSchema);
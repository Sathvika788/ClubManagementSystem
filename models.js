const mongoose = require('mongoose');

const Users = mongoose.model('Users', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true},
    password: { type: String, required: true },
}), 'Users');

const LeaderBoard = mongoose.model('LeaderBoard', new mongoose.Schema({
    createdAt: {type: Date, default: Date.now},
    userId: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    location: { type: String, required: true},
    dataset: { type: String, required: true },
    language: { type: String, required: true },
    scores: { type: mongoose.Schema.Types.Mixed, required: true },
}), 'LeaderBoard');

module.exports = { Users, LeaderBoard };
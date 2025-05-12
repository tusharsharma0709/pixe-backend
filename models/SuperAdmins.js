// models/SuperAdmins.js
const mongoose = require('mongoose');

const superAdminSchema = new mongoose.Schema({
    first_name: {
        type: String,
        required: true,
        trim: true
    },
    last_name: {
        type: String,
        required: true,
        trim: true
    },
    mobile: {
        type: Number,
        required: true
    },
    email_id: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const SuperAdmin = mongoose.model("SuperAdmins", superAdminSchema);
module.exports = { SuperAdmin };
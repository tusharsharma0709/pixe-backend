const mongoose = require('mongoose');


const superAdminSchema =new mongoose.Schema({
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    mobile: {
        type: Number,
        required: true
    },
    email_id: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    }
},
{
    timestamps:true
}
);

const SuperAdmin = mongoose.model("SuperAdmins", superAdminSchema);
module.exports = {SuperAdmin};
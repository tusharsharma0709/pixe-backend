const mongoose = require('mongoose');


const adminSchema =new mongoose.Schema({
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

const Admin = mongoose.model("Admins", adminSchema);
module.exports = {Admin};
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    category: { 
        type: String, 
        required: true,
        enum: ['Goods','Services']
    },
    name: { 
        type: String, 
        required: true 
    },
    image: { 
        type: String, 
        required: true 
    }, 
    description: { 
        type: String,
        required: true
    },
    price: {
        type: String,
        required: true
    }
}, { timestamps: true });

const Product = mongoose.model('Products', productSchema);
module.exports = { Product };

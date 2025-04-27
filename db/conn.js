const mongoose = require('mongoose');
require('dotenv').config();  // Load environment variables

// Connect to MongoDB using the connection URL from the .env file
mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log("Connection is Successful");
    })
    .catch((error) => {
        console.error("No Connection: ", error);
    });

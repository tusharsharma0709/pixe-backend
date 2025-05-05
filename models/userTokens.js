// models/userTokens.js
const mongoose = require('mongoose');
const userTokenSchema = new mongoose.Schema({
  userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Users", 
      required: true 
  },
  token: { 
      type: String, 
      required: true 
  },
  expiresAt: {
      type: Date,
      default: function() {
          return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      }
  }
}, { timestamps: true });

const UserToken = mongoose.model("userTokens", userTokenSchema);
module.exports = { UserToken };

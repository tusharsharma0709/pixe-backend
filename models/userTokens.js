const mongoose = require("mongoose");

const userTokenSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Users", 
      required: true 
    },
    token: { 
      type: String, 
      required: true 
    }
  },
  { timestamps: true }
);

const UserToken = mongoose.model("userTokens", userTokenSchema);
module.exports = { UserToken };

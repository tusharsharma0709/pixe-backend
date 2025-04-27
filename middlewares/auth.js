const jwt = require("jsonwebtoken");
const { AdminTokens } = require("../models/adminTokens");
const { UserToken } = require("../models/userTokens");
const JWT_SECRET = process.env.JWT_SECRET;

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check for token in header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.adminId) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Check token exists in DB
    const tokenExists = await AdminTokens.findOne({
      adminId: decoded.adminId,
      token,
      tokenType: "login",
    });

    if (!tokenExists) {
      return res.status(401).json({ success: false, message: "Token expired or invalid" });
    }

    // Attach superAdminId to req
    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

const userAuth = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
      return res.status(401).json({ success: false,message: "Token is required" });
  }

  try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Ensure the secret key is correct

      // Check if the token exists in the UserToken collection
      const userToken = await UserToken.findOne({ token });

      if (!userToken) {
          return res.status(401).json({ success: false, message: "Token not found or is invalid" });
      }

      // Check if token is expired
      if (userToken.expiresAt < new Date()) {
          return res.status(401).json({ success: fasle, message: "Token has expired" });
      }

      req.userId = decoded.userId;  // Attach the userId to the request object
      req.token = token;  // Attach the token to the request object

      next(); // Proceed to the next middleware or route handler
  } catch (error) {
      console.error("Token verification error:", error.message);
      return res.status(401).json({success: false, message: "Unauthorized", error: error });
  }
};

module.exports = {
    adminAuth,
    userAuth
}

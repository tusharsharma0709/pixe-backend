const jwt = require("jsonwebtoken");
const { AdminTokens } = require("../models/adminTokens");
const { UserToken } = require("../models/userTokens");
const { SuperAdminTokens } = require("../models/SuperAdminTokens");
const { AgentToken } = require("../models/AgentTokens");
const JWT_SECRET = process.env.JWT_SECRET;

const superAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check for token in header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET); // Use process.env.JWT_SECRET instead of JWT_SECRET
    
    // Check for superAdminId in decoded token (not adminId)
    if (!decoded || !decoded.superAdminId) { // Changed from adminId to superAdminId
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Check token exists in DB
    const tokenExists = await SuperAdminTokens.findOne({
      superAdminId: decoded.superAdminId,
      token,
      tokenType: "login",
    });

    if (!tokenExists) {
      return res.status(401).json({ success: false, message: "Token expired or invalid" });
    }

    // Attach superAdminId to req
    req.superAdminId = decoded.superAdminId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

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

    // Attach adminId to req
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
      return res.status(401).json({ success: false, message: "Token is required" });
  }

  try {
      // Verify the token
      const decoded = jwt.verify(token, JWT_SECRET); // Ensure the secret key is correct

      // Check if the token exists in the UserToken collection
      const userToken = await UserToken.findOne({ token });

      if (!userToken) {
          return res.status(401).json({ success: false, message: "Token not found or is invalid" });
      }

      // Check if token is expired
      if (userToken.expiresAt < new Date()) {
          return res.status(401).json({ success: false, message: "Token has expired" });
      }

      req.userId = decoded.userId;  // Attach the userId to the request object
      req.token = token;  // Attach the token to the request object

      next(); // Proceed to the next middleware or route handler
  } catch (error) {
      console.error("Token verification error:", error.message);
      return res.status(401).json({success: false, message: "Unauthorized", error: error });
  }
};

const agentAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check for token in header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.agentId) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Check token exists in DB
    const tokenExists = await AgentToken.findOne({
      agentId: decoded.agentId,
      token,
      tokenType: "login",
      isRevoked: false
    });

    if (!tokenExists) {
      return res.status(401).json({ success: false, message: "Token expired or invalid" });
    }

    // Verify token hasn't expired
    if (tokenExists.expiresAt && tokenExists.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: "Token has expired" });
    }

    // Update last used timestamp
    tokenExists.lastUsed = new Date();
    await tokenExists.save();

    // Attach agentId to req
    req.agentId = decoded.agentId;
    
    // Also attach adminId if present in the token
    if (decoded.adminId) {
      req.adminId = decoded.adminId;
    }
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

// Check for either admin or agent authentication
const adminOrAgentAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check for token in header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Try to verify as admin first
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.adminId) {
        // Check token exists in DB
        const tokenExists = await AdminTokens.findOne({
          adminId: decoded.adminId,
          token,
          tokenType: "login",
        });

        if (tokenExists) {
          // Attach adminId to req
          req.adminId = decoded.adminId;
          return next();
        }
      }
      
      if (decoded.agentId) {
        // Check token exists in DB
        const tokenExists = await AgentToken.findOne({
          agentId: decoded.agentId,
          token,
          tokenType: "login",
          isRevoked: false
        });

        if (tokenExists && (!tokenExists.expiresAt || tokenExists.expiresAt > new Date())) {
          // Update last used timestamp
          tokenExists.lastUsed = new Date();
          await tokenExists.save();
          
          // Attach agentId to req
          req.agentId = decoded.agentId;
          
          // Also attach adminId if present in the token
          if (decoded.adminId) {
            req.adminId = decoded.adminId;
          }
          
          return next();
        }
      }

      // If we got here, token was invalid for both admin and agent
      return res.status(401).json({ success: false, message: "Token expired or invalid" });
      
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
        error: error.message,
      });
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message,
    });
  }
};

const adminOrSuperAdminAuth = async (req, res, next) => {
  try {
      const authHeader = req.headers.authorization;

      // Check for token in header
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ success: false, message: "Authorization token missing" });
      }

      const token = authHeader.split(" ")[1];

      try {
          // Verify token
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Check if it's an admin token
          if (decoded.adminId) {
              const tokenExists = await AdminTokens.findOne({
                  adminId: decoded.adminId,
                  token,
                  tokenType: "login",
              });

              if (tokenExists) {
                  req.adminId = decoded.adminId;
                  return next();
              }
          }

          // Check if it's a superadmin token
          if (decoded.superAdminId) {
              const tokenExists = await SuperAdminTokens.findOne({
                  superAdminId: decoded.superAdminId,
                  token,
                  tokenType: "login",
              });

              if (tokenExists) {
                  req.superAdminId = decoded.superAdminId;
                  return next();
              }
          }

          // If we reach here, token is invalid for both roles
          return res.status(401).json({ success: false, message: "Invalid token" });

      } catch (jwtError) {
          return res.status(401).json({ success: false, message: "Invalid token" });
      }

  } catch (error) {
      return res.status(401).json({
          success: false,
          message: "Authentication failed",
          error: error.message,
      });
  }
};

module.exports = {
  superAdminAuth,
  adminAuth,
  userAuth,
  agentAuth,
  adminOrAgentAuth,
  adminOrSuperAdminAuth  // Add this new middleware
};
// middlewares/userTypeMiddleware.js
const userTypeMiddleware = (req, res, next) => {
    // Set userType and userId based on which auth middleware was used
    if (req.superAdminId) {
        req.userType = 'superadmin';
        req.userId = req.superAdminId;
    } else if (req.adminId) {
        req.userType = 'admin';
        req.userId = req.adminId;
    } else if (req.agentId) {
        req.userType = 'agent';
        req.userId = req.agentId;
    } else if (req.userId) {
        req.userType = 'user';
        // userId is already set
    } else {
        // Default to system if no ID is set (should not happen in normal use)
        req.userType = 'system';
        req.userId = null;
    }
    
    next();
};

module.exports = userTypeMiddleware;
// controllers/WhatsAppNumberController.js
const { WhatsappNumber } = require('../models/WhatsappNumbers');
const { Admin } = require('../models/Admins');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { Statistic } = require('../models/Statistics');
const QRCode = require('qrcode');
const axios = require('axios');

const WhatsAppNumberController = {
    // Get all WhatsApp numbers
    getAllNumbers: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { status, verified, adminId, page = 1, limit = 10 } = req.query;
            
            let query = {};
            
            // Role-based access
            if (userType === 'superadmin') {
                // Super admin can see all numbers
                if (adminId) {
                    query.adminId = adminId;
                }
            } else if (userType === 'admin') {
                // Admin can only see their assigned numbers
                query.adminId = userId;
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view WhatsApp numbers'
                });
            }
            
            // Apply filters
            if (status) query.status = status;
            if (verified !== undefined) query.verified = verified === 'true';
            
            const skip = (page - 1) * limit;
            
            const numbers = await WhatsappNumber.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('adminId', 'first_name last_name email_id business_name')
                .populate('assignedBy', 'first_name last_name')
                .populate('superAdminId', 'first_name last_name');
                
            const total = await WhatsappNumber.countDocuments(query);
            
            return res.status(200).json({
                success: true,
                data: {
                    numbers,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });
        } catch (error) {
            console.error("Error in getAllNumbers:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get WhatsApp number by ID
    getNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const number = await WhatsappNumber.findById(id)
                .populate('adminId', 'first_name last_name email_id business_name')
                .populate('assignedBy', 'first_name last_name')
                .populate('superAdminId', 'first_name last_name');
                
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && number.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this WhatsApp number'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    number
                }
            });
        } catch (error) {
            console.error("Error in getNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Create/Add new WhatsApp number (Super Admin only)
    createNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            
            // Only super admin can add new numbers
            if (userType !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin can add WhatsApp numbers'
                });
            }
            
            const numberData = req.body;
            
            // Validate required fields
            if (!numberData.phoneNumber || !numberData.displayName) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number and display name are required'
                });
            }
            
            // Check if number already exists
            const existingNumber = await WhatsappNumber.findOne({ phoneNumber: numberData.phoneNumber });
            if (existingNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'This WhatsApp number already exists'
                });
            }
            
            // Set creator
            numberData.superAdminId = userId;
            numberData.status = 'pending_approval';
            
            const number = await WhatsappNumber.create(numberData);
            
            // Generate QR code for verification
            const qrCode = await QRCode.toDataURL(`https://wa.me/${number.phoneNumber}`);
            number.qrCode = qrCode;
            await number.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'SuperAdmins',
                action: 'custom',
                entityType: 'Other',
                entityId: number._id,
                description: `Added WhatsApp number: ${number.phoneNumber}`,
                status: 'success'
            });
            
            return res.status(201).json({
                success: true,
                data: {
                    number
                }
            });
        } catch (error) {
            console.error("Error in createNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Assign WhatsApp number to admin (Super Admin only)
    assignNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const { adminId } = req.body;
            
            // Only super admin can assign numbers
            if (userType !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin can assign WhatsApp numbers'
                });
            }
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // Check if number is already assigned
            if (number.adminId) {
                return res.status(400).json({
                    success: false,
                    message: 'This WhatsApp number is already assigned'
                });
            }
            
            // Verify admin exists
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: 'Admin not found'
                });
            }
            
            // Assign number
            number.adminId = adminId;
            number.assignedAt = new Date();
            number.assignedBy = userId;
            await number.save();
            
            // Update admin with WhatsApp number
            admin.whatsappNumber = {
                number: number.phoneNumber,
                isActive: true,
                assignedAt: new Date()
            };
            await admin.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'SuperAdmins',
                action: 'custom',
                entityType: 'Admin',
                entityId: adminId,
                description: `Assigned WhatsApp number ${number.phoneNumber} to admin`,
                status: 'success'
            });
            
            // Create notification for admin
            await Notification.create({
                type: 'system',
                title: 'WhatsApp Number Assigned',
                description: `WhatsApp number ${number.phoneNumber} has been assigned to you`,
                forAdmin: adminId,
                priority: 'high'
            });
            
            return res.status(200).json({
                success: true,
                message: 'WhatsApp number assigned successfully',
                data: {
                    number
                }
            });
        } catch (error) {
            console.error("Error in assignNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Unassign WhatsApp number (Super Admin only)
    unassignNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            // Only super admin can unassign numbers
            if (userType !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin can unassign WhatsApp numbers'
                });
            }
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            if (!number.adminId) {
                return res.status(400).json({
                    success: false,
                    message: 'This WhatsApp number is not assigned'
                });
            }
            
            // Update admin record
            const admin = await Admin.findById(number.adminId);
            if (admin) {
                admin.whatsappNumber = null;
                await admin.save();
            }
            
            // Unassign number
            const previousAdminId = number.adminId;
            number.adminId = null;
            number.assignedAt = null;
            number.assignedBy = null;
            await number.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'SuperAdmins',
                action: 'custom',
                entityType: 'Admin',
                entityId: previousAdminId,
                description: `Unassigned WhatsApp number ${number.phoneNumber} from admin`,
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                message: 'WhatsApp number unassigned successfully',
                data: {
                    number
                }
            });
        } catch (error) {
            console.error("Error in unassignNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Update WhatsApp number
    updateNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const updateData = req.body;
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // Check permission
            if (userType === 'admin') {
                // Admins can only update certain fields of their assigned numbers
                if (number.adminId?.toString() !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: 'Not authorized to update this WhatsApp number'
                    });
                }
                
                // Restrict fields that admins can update
                const allowedFields = ['businessProfile', 'settings', 'defaultTemplate'];
                Object.keys(updateData).forEach(key => {
                    if (!allowedFields.includes(key)) {
                        delete updateData[key];
                    }
                });
            }
            
            // Update number
            Object.assign(number, updateData);
            await number.save();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: userType === 'superadmin' ? 'SuperAdmins' : 'Admins',
                action: 'custom',
                entityType: 'Other',
                entityId: number._id,
                description: `Updated WhatsApp number: ${number.phoneNumber}`,
                status: 'success'
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    number
                }
            });
        } catch (error) {
            console.error("Error in updateNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Verify WhatsApp number
    verifyNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const { verificationCode } = req.body;
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // Only super admin or assigned admin can verify
            if (userType === 'admin' && number.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to verify this WhatsApp number'
                });
            }
            
            // In real implementation, this would verify with WhatsApp Business API
            // For now, we'll simulate verification
            if (verificationCode === '123456') { // Mock verification code
                number.verified = true;
                number.verifiedAt = new Date();
                number.status = 'active';
                await number.save();
                
                return res.status(200).json({
                    success: true,
                    message: 'WhatsApp number verified successfully',
                    data: {
                        number
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid verification code'
                });
            }
        } catch (error) {
            console.error("Error in verifyNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get WhatsApp metrics
    getNumberMetrics: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            const { startDate, endDate } = req.query;
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && number.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view metrics for this WhatsApp number'
                });
            }
            
            // Get metrics from Statistics
            const query = {
                entityType: 'whatsapp_number',
                entityId: number._id
            };
            
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }
            
            const statistics = await Statistic.find(query);
            
            // Aggregate metrics
            const metrics = {
                messagesReceived: statistics.filter(s => s.metricType === 'messages_received').reduce((sum, s) => sum + s.value, 0),
                messagesSent: statistics.filter(s => s.metricType === 'messages_sent').reduce((sum, s) => sum + s.value, 0),
                activeConversations: number.capacity.currentChats,
                dailyActiveUsers: number.metrics.dailyActiveUsers,
                averageResponseTime: number.metrics.averageResponseTime
            };
            
            return res.status(200).json({
                success: true,
                data: {
                    number: {
                        id: number._id,
                        phoneNumber: number.phoneNumber,
                        displayName: number.displayName
                    },
                    metrics,
                    capacity: number.capacity,
                    qualityRating: number.qualityRating
                }
            });
        } catch (error) {
            console.error("Error in getNumberMetrics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Sync WhatsApp number with WhatsApp Business API
    syncNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // Check permission
            if (userType === 'admin' && number.adminId?.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to sync this WhatsApp number'
                });
            }
            
            // In real implementation, this would sync with WhatsApp Business API
            // For now, we'll simulate a sync
            number.lastSync = new Date();
            
            // Update some mock metrics
            number.metrics.totalMessages += Math.floor(Math.random() * 100);
            number.metrics.totalUsers += Math.floor(Math.random() * 20);
            
            await number.save();
            
            return res.status(200).json({
                success: true,
                message: 'WhatsApp number synced successfully',
                data: {
                    number
                }
            });
        } catch (error) {
            console.error("Error in syncNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Delete WhatsApp number (Super Admin only)
    deleteNumber: async (req, res) => {
        try {
            const { userType, userId } = req;
            const { id } = req.params;
            
            // Only super admin can delete numbers
            if (userType !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin can delete WhatsApp numbers'
                });
            }
            
            const number = await WhatsappNumber.findById(id);
            
            if (!number) {
                return res.status(404).json({
                    success: false,
                    message: 'WhatsApp number not found'
                });
            }
            
            // If assigned, update admin record
            if (number.adminId) {
                const admin = await Admin.findById(number.adminId);
                if (admin) {
                    admin.whatsappNumber = null;
                    await admin.save();
                }
            }
            
            await number.deleteOne();
            
            // Log activity
            await ActivityLog.create({
                actorId: userId,
                actorModel: 'SuperAdmins',
                action: 'custom',
                entityType: 'Other',
                entityId: number._id,
                description: `Deleted WhatsApp number: ${number.phoneNumber}`,
                status: 'success'
            });
            
            return res.status(204).json({
                success: true,
                data: null
            });
        } catch (error) {
            console.error("Error in deleteNumber:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },
    
    // Get available numbers for assignment
    getAvailableNumbers: async (req, res) => {
        try {
            const { userType } = req;
            
            // Only super admin can view available numbers
            if (userType !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only super admin can view available numbers'
                });
            }
            
            const availableNumbers = await WhatsappNumber.find({
                adminId: null,
                status: 'active',
                verified: true
            }).sort({ capacity: { currentChats: 1 } });
            
            return res.status(200).json({
                success: true,
                data: {
                    numbers: availableNumbers
                }
            });
        } catch (error) {
            console.error("Error in getAvailableNumbers:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = WhatsAppNumberController;
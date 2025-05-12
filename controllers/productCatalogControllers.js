// controllers/ProductCatalogController.js
const { ProductCatalog } = require('../models/ProductCatalogs');
const { Admin } = require('../models/Admins');
const { SuperAdmin } = require('../models/SuperAdmins');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const { Product } = require('../models/Products');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

// Helper function to log activity
const logActivity = async (data) => {
    try {
        const activityLog = new ActivityLog(data);
        await activityLog.save();
        return activityLog;
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

// Helper function to create notification
const createNotification = async (data) => {
    try {
        const notification = new Notification(data);
        await notification.save();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};

const ProductCatalogController = {
    // Create a new product catalog
    createCatalog: async (req, res) => {
        try {
            const { name, description, category, settings, integrations } = req.body;
            const adminId = req.adminId;

            // Validate required fields
            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Catalog name is required"
                });
            }

            // Check if a catalog with the same name already exists
            const existingCatalog = await ProductCatalog.findOne({
                adminId,
                name
            });

            if (existingCatalog) {
                return res.status(400).json({
                    success: false,
                    message: "A catalog with this name already exists",
                    data: existingCatalog
                });
            }

            // Check if admin exists
            const admin = await Admin.findById(adminId);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: "Admin not found"
                });
            }

            // Check if it's the first catalog (to set as default)
            const catalogCount = await ProductCatalog.countDocuments({ adminId });
            const isDefault = catalogCount === 0;

            // Create new product catalog
            const productCatalog = new ProductCatalog({
                name,
                description,
                adminId,
                category: category || 'general',
                status: 'draft',
                isDefault,
                settings: settings || {
                    currencyCode: 'INR',
                    isDigitalOnly: false,
                    hasVariants: false,
                    taxRate: 0
                },
                integrations: integrations || {}
            });

            await productCatalog.save();

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: `${admin.first_name} ${admin.last_name}`,
                action: 'product_created',
                entityType: 'ProductCatalog',
                entityId: productCatalog._id,
                description: `Created product catalog: ${productCatalog.name}`,
                adminId
            });

            return res.status(201).json({
                success: true,
                message: "Product catalog created successfully",
                data: productCatalog
            });
        } catch (error) {
            console.error("Error in createCatalog:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all catalogs for an admin
    getAdminCatalogs: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { status, category, search, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

            // Build query
            const query = { adminId };

            if (status) query.status = status;
            if (category) query.category = category;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await ProductCatalog.countDocuments(query);

            // Execute query with pagination
            const productCatalogs = await ProductCatalog.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            // Get product counts for each catalog
            const catalogsWithProductCount = await Promise.all(
                productCatalogs.map(async (catalog) => {
                    const productCount = await Product.countDocuments({
                        adminId,
                        catalogId: catalog._id.toString()
                    });
                    
                    return {
                        ...catalog.toObject(),
                        productCount
                    };
                })
            );

            return res.status(200).json({
                success: true,
                data: catalogsWithProductCount,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getAdminCatalogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get all catalogs for SuperAdmin
    getSuperAdminCatalogs: async (req, res) => {
        try {
            const { status, adminId, search, sortBy, sortOrder, page = 1, limit = 10 } = req.query;

            // Build query
            const query = {};

            if (status) query.status = status;
            if (adminId) query.adminId = adminId;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort options
            const sortOptions = {};
            if (sortBy) {
                sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
            } else {
                sortOptions.createdAt = -1; // Default to newest first
            }

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await ProductCatalog.countDocuments(query);

            // Execute query with pagination
            const productCatalogs = await ProductCatalog.find(query)
                .populate('adminId', 'first_name last_name business_name')
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return res.status(200).json({
                success: true,
                data: productCatalogs,
                pagination: {
                    totalRecords: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error("Error in getSuperAdminCatalogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Get catalog by ID
    getCatalog: async (req, res) => {
        try {
            const { id } = req.params;

            const productCatalog = await ProductCatalog.findById(id);

            if (!productCatalog) {
                return res.status(404).json({
                    success: false,
                    message: "Product catalog not found"
                });
            }

            // Check if the user has permission to access this catalog
            if (req.adminId && productCatalog.adminId.toString() !== req.adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to access this catalog"
                });
            }

            // Get product count for this catalog
            const productCount = await Product.countDocuments({
                adminId: productCatalog.adminId,
                catalogId: productCatalog._id.toString()
            });

            // Get some product samples
            const productSamples = await Product.find({
                adminId: productCatalog.adminId,
                catalogId: productCatalog._id.toString()
            })
            .sort({ createdAt: -1 })
            .limit(5);

            return res.status(200).json({
                success: true,
                data: {
                    ...productCatalog.toObject(),
                    productCount,
                    productSamples
                }
            });
        } catch (error) {
            console.error("Error in getCatalog:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Update catalog
    updateCatalog: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, category, settings, integrations } = req.body;
            
            // Determine if admin or superadmin is making the update
            const actorId = req.adminId || req.superAdminId;
            const actorRole = req.adminId ? 'admin' : 'superadmin';

            const productCatalog = await ProductCatalog.findById(id);

            if (!productCatalog) {
                return res.status(404).json({
                    success: false,
                    message: "Product catalog not found"
                });
            }

            // Check permissions
            if (actorRole === 'admin') {
                if (productCatalog.adminId.toString() !== actorId) {
                    return res.status(403).json({
                        success: false,
                        message: "You don't have permission to update this catalog"
                    });
                }

                // Admins cannot update certain fields if catalog is already approved
                if (productCatalog.status === 'active' || productCatalog.status === 'pending') {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot update catalog in its current status. Please contact Super Admin."
                    });
                }
            }

            // Build update object
            const updateData = {};
            
            if (name) updateData.name = name;
            if (description) updateData.description = description;
            if (category) updateData.category = category;
            
            // Only update settings and integrations if they're provided
            if (settings) {
                updateData.settings = {
                    ...productCatalog.settings,
                    ...settings
                };
            }
            
            if (integrations) {
                updateData.integrations = {
                    ...productCatalog.integrations,
                    ...integrations
                };
            }

            // Additional updates for superadmin
            if (actorRole === 'superadmin') {
                if (req.body.status) updateData.status = req.body.status;
                if (req.body.superAdminNotes) updateData.superAdminNotes = req.body.superAdminNotes;
                if (req.body.facebookCatalogId) updateData.facebookCatalogId = req.body.facebookCatalogId;
                if (req.body.facebookCatalogUrl) updateData.facebookCatalogUrl = req.body.facebookCatalogUrl;
                
                // Handle catalog approval
                if (req.body.status === 'active' && productCatalog.status !== 'active') {
                    updateData.reviewedAt = new Date();
                    updateData.superAdminId = req.superAdminId;
                }
                
                // Handle catalog rejection
                if (req.body.status === 'rejected' && req.body.rejectionReason) {
                    updateData.rejectionReason = req.body.rejectionReason;
                    updateData.reviewedAt = new Date();
                    updateData.superAdminId = req.superAdminId;
                }
            }

            // If admin is submitting catalog for review
            if (actorRole === 'admin' && req.body.status === 'pending' && productCatalog.status === 'draft') {
                updateData.status = 'pending';
            }

            // Update the catalog
            const updatedCatalog = await ProductCatalog.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true }
            );

            // Get actor details
            let actorName = null;
            let actorModel = actorRole === 'admin' ? 'Admins' : 'SuperAdmins';
            
            if (actorRole === 'admin') {
                const admin = await Admin.findById(actorId);
                actorName = admin ? `${admin.first_name} ${admin.last_name}` : null;
            } else {
                const superAdmin = await SuperAdmin.findById(actorId);
                actorName = superAdmin ? `${superAdmin.first_name} ${superAdmin.last_name}` : null;
            }

            // Log activity
            await logActivity({
                actorId,
                actorModel,
                actorName,
                action: 'product_updated',
                entityType: 'ProductCatalog',
                entityId: updatedCatalog._id,
                description: `Updated product catalog: ${updatedCatalog.name}`,
                adminId: productCatalog.adminId
            });

            // Create notifications if status changed
            if (updateData.status && updateData.status !== productCatalog.status) {
                if (updateData.status === 'active') {
                    // Notify admin that catalog was approved
                    await createNotification({
                        title: "Product Catalog Approved",
                        description: `Your product catalog "${productCatalog.name}" has been approved`,
                        type: 'product_approval',
                        priority: 'high',
                        forAdmin: productCatalog.adminId,
                        relatedTo: {
                            model: 'ProductCatalog',
                            id: productCatalog._id
                        },
                        actionUrl: `/product-catalogs/${productCatalog._id}`
                    });
                } else if (updateData.status === 'rejected') {
                    // Notify admin that catalog was rejected
                    await createNotification({
                        title: "Product Catalog Rejected",
                        description: `Your product catalog "${productCatalog.name}" has been rejected`,
                        type: 'product_rejection',
                        priority: 'high',
                        forAdmin: productCatalog.adminId,
                        relatedTo: {
                            model: 'ProductCatalog',
                            id: productCatalog._id
                        },
                        actionUrl: `/product-catalogs/${productCatalog._id}`
                    });
                } else if (updateData.status === 'pending') {
                    // Notify super admins about catalog pending review
                    await createNotification({
                        title: "Product Catalog Pending Review",
                        description: `A new product catalog "${productCatalog.name}" is pending approval`,
                        type: 'product_request',
                        priority: 'medium',
                        forSuperAdmin: true,
                        relatedTo: {
                            model: 'ProductCatalog',
                            id: productCatalog._id
                        },
                        actionUrl: `/super-admin/product-catalogs/${productCatalog._id}`
                    });
                }
            }

            return res.status(200).json({
                success: true,
                message: "Product catalog updated successfully",
                data: updatedCatalog
            });
        } catch (error) {
            console.error("Error in updateCatalog:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Delete catalog
    deleteCatalog: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const productCatalog = await ProductCatalog.findById(id);

            if (!productCatalog) {
                return res.status(404).json({
                    success: false,
                    message: "Product catalog not found"
                });
            }

            // Check permissions
            if (productCatalog.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to delete this catalog"
                });
            }

            // Check if it's a default catalog
            if (productCatalog.isDefault) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete the default catalog. Please set another catalog as default first."
                });
            }

            // Check if catalog has products
            const productCount = await Product.countDocuments({
                adminId,
                catalogId: productCatalog._id.toString()
            });

            if (productCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete catalog with ${productCount} products. Please delete or move products first.`
                });
            }

            // Delete the catalog
            await ProductCatalog.findByIdAndDelete(id);

            // Get admin details
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'product_deleted',
                entityType: 'ProductCatalog',
                entityId: productCatalog._id,
                description: `Deleted product catalog: ${productCatalog.name}`,
                adminId
            });

            return res.status(200).json({
                success: true,
                message: "Product catalog deleted successfully"
            });
        } catch (error) {
            console.error("Error in deleteCatalog:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    // Set catalog as default
    setDefaultCatalog: async (req, res) => {
        try {
            const { id } = req.params;
            const adminId = req.adminId;

            const productCatalog = await ProductCatalog.findById(id);

            if (!productCatalog) {
                return res.status(404).json({
                    success: false,
                    message: "Product catalog not found"
                });
            }

            // Check permissions
            if (productCatalog.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to update this catalog"
                });
            }

            // Check if catalog is active
            if (productCatalog.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    message: "Cannot set an inactive catalog as default"
                });
            }

            // Find current default catalog and unset it
            await ProductCatalog.updateMany(
                { adminId, isDefault: true },
                { $set: { isDefault: false } }
            );

            // Set new default catalog
            productCatalog.isDefault = true;
            await productCatalog.save();

            // Get admin details
            const admin = await Admin.findById(adminId);

            // Log activity
            await logActivity({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'settings_updated',
                entityType: 'ProductCatalog',
                entityId: productCatalog._id,
                description: `Set product catalog as default: ${productCatalog.name}`,
                adminId
            });

            return res.status(200).json({
                success: true,
                message: "Default catalog updated successfully",
                data: productCatalog
            });
        } catch (error) {
            console.error("Error in setDefaultCatalog:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = ProductCatalogController;
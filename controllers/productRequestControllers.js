// controllers/productRequestController.js
const { ProductRequest } = require('../models/ProductRequests');
const { Product } = require('../models/Products');
const { ProductCatalog } = require('../models/ProductCatalogs');
const { Admin } = require('../models/Admins');
const { SuperAdmin } = require('../models/SuperAdmins');
const { Notification } = require('../models/Notifications');
const { ActivityLog } = require('../models/ActivityLogs');
const { FileUpload } = require('../models/FileUploads');
const upload = require('../middlewares/multer');

/**
 * Admin Functions
 */

/**
 * Create a new product request
 */
const createProductRequest = async (req, res) => {
    try {
        const adminId = req.adminId;
        
        // Validate the admin exists and is active
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }
        
        if (!admin.status) {
            return res.status(403).json({
                success: false,
                message: "Your account is not active. Please contact the Super Admin."
            });
        }
        
        // Check if admin has verified Facebook credentials
        if (!admin.facebookAccess || !admin.facebookAccess.isVerified) {
            return res.status(400).json({
                success: false,
                message: "You need to verify your Facebook credentials before creating product requests"
            });
        }
        
        // Extract data from request
        const { 
            name, 
            description, 
            price, 
            salePrice,
            currency,
            category,
            subCategory,
            brand,
            attributes,
            inventory,
            shipping,
            isDigital,
            hasVariants,
            catalogId,
            adminNotes,
            taxable,
            taxClass,
            taxRate
        } = req.body;
        
        // Validate required fields
        if (!name || !price) {
            return res.status(400).json({
                success: false,
                message: "Name and price are required"
            });
        }
        
        // Validate catalog if provided
        if (catalogId) {
            const catalog = await ProductCatalog.findById(catalogId);
            if (!catalog) {
                return res.status(404).json({
                    success: false,
                    message: "Product catalog not found"
                });
            }
            
            // Check if the catalog belongs to the admin
            if (catalog.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to use this catalog"
                });
            }
        }
        
        // Process uploaded files if any
        let productImages = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const fileUpload = new FileUpload({
                    filename: file.filename || `product_image_${Date.now()}`,
                    originalFilename: file.originalname,
                    path: file.path || file.location,
                    url: file.location || file.path,
                    mimeType: file.mimetype,
                    size: file.size,
                    uploadedBy: {
                        id: adminId,
                        role: 'admin'
                    },
                    adminId,
                    entityType: 'product_request',
                    isPublic: true
                });
                
                await fileUpload.save();
                productImages.push({
                    url: fileUpload.url,
                    isPrimary: productImages.length === 0, // First image is primary
                    caption: name
                });
            }
        }
        
        // Create product request
        const productRequest = new ProductRequest({
            adminId,
            name,
            description,
            price: parseFloat(price),
            salePrice: salePrice ? parseFloat(salePrice) : undefined,
            currency: currency || 'INR',
            category: category || 'general',
            subCategory,
            brand,
            images: productImages,
            attributes: attributes || [],
            inventory: inventory || { quantity: 0 },
            shipping: shipping || {},
            isDigital: isDigital || false,
            hasVariants: hasVariants || false,
            catalogId,
            status: 'submitted',
            adminNotes,
            taxable: taxable !== undefined ? taxable : true,
            taxClass: taxClass || 'standard',
            taxRate: taxRate !== undefined ? parseFloat(taxRate) : null
        });
        
        await productRequest.save();
        
        // Log activity
        await ActivityLog.create({
            actorId: adminId,
            actorModel: 'Admins',
            actorName: `${admin.first_name} ${admin.last_name}`,
            action: 'product_requested',
            entityType: 'ProductRequest',
            entityId: productRequest._id,
            description: `Product request "${name}" was submitted by admin`,
            status: 'success'
        });
        
        // Create notification for Super Admins
        await Notification.create({
            title: 'New Product Request',
            description: `${admin.first_name} ${admin.last_name} has submitted a new product request: ${name}`,
            type: 'product_request',
            forSuperAdmin: true,
            relatedTo: {
                model: 'ProductRequest',
                id: productRequest._id
            },
            priority: 'medium'
        });
        
        res.status(201).json({
            success: true,
            message: "Product request submitted successfully",
            data: {
                _id: productRequest._id,
                name: productRequest.name,
                price: productRequest.price,
                status: productRequest.status,
                createdAt: productRequest.createdAt
            }
        });
    } catch (error) {
        console.error("Error creating product request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get all product requests for an admin
 */
const getAdminProductRequests = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { status, limit = 20, page = 1, sort = 'createdAt', order = 'desc' } = req.query;
        
        // Build query
        const query = { adminId };
        
        // Add status filter if provided
        if (status) {
            query.status = status;
        }
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === 'desc' ? -1 : 1;
        const sortOptions = {};
        sortOptions[sort] = sortOrder;
        
        // Get product requests with pagination
        const productRequests = await ProductRequest.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('catalogId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedProductId', 'name status');
        
        // Get total count for pagination
        const totalCount = await ProductRequest.countDocuments(query);
        
        res.status(200).json({
            success: true,
            message: "Product requests fetched successfully",
            data: {
                productRequests,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Error getting product requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get product request by ID (Admin)
 */
const getProductRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        
        // Find product request
        const productRequest = await ProductRequest.findById(id)
            .populate('catalogId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedProductId', 'name status');
        
        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }
        
        // Check if the product request belongs to the admin
        if (productRequest.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to view this product request"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Product request fetched successfully",
            data: productRequest
        });
    } catch (error) {
        console.error("Error getting product request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Update product request (Admin)
 */
const updateProductRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        
        // Find product request
        const productRequest = await ProductRequest.findById(id);
        
        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }
        
        // Check if the product request belongs to the admin
        if (productRequest.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to update this product request"
            });
        }
        
        // Check if product request can be updated
        if (!['draft', 'rejected'].includes(productRequest.status)) {
            return res.status(400).json({
                success: false,
                message: `Product request cannot be updated in "${productRequest.status}" status`
            });
        }
        
        // Extract data from request
        const { 
            name, 
            description, 
            price, 
            salePrice,
            currency,
            category,
            subCategory,
            brand,
            attributes,
            inventory,
            shipping,
            isDigital,
            hasVariants,
            catalogId,
            adminNotes,
            taxable,
            taxClass,
            taxRate
        } = req.body;
        
        // Validate catalog if provided
        if (catalogId) {
            const catalog = await ProductCatalog.findById(catalogId);
            if (!catalog) {
                return res.status(404).json({
                    success: false,
                    message: "Product catalog not found"
                });
            }
            
            // Check if the catalog belongs to the admin
            if (catalog.adminId.toString() !== adminId) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to use this catalog"
                });
            }
        }
        
        // Process uploaded files if any
        let newProductImages = [];
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const fileUpload = new FileUpload({
                    filename: file.filename || `product_image_${Date.now()}`,
                    originalFilename: file.originalname,
                    path: file.path || file.location,
                    url: file.location || file.path,
                    mimeType: file.mimetype,
                    size: file.size,
                    uploadedBy: {
                        id: adminId,
                        role: 'admin'
                    },
                    adminId,
                    entityType: 'product_request',
                    entityId: productRequest._id,
                    isPublic: true
                });
                
                await fileUpload.save();
                newProductImages.push({
                    url: fileUpload.url,
                    isPrimary: productRequest.images.length === 0 && newProductImages.length === 0, // Primary if no images exist
                    caption: productRequest.name
                });
            }
        }
        
        // Update fields
        if (name) productRequest.name = name;
        if (description !== undefined) productRequest.description = description;
        if (price) productRequest.price = parseFloat(price);
        if (salePrice !== undefined) productRequest.salePrice = salePrice ? parseFloat(salePrice) : null;
        if (currency) productRequest.currency = currency;
        if (category) productRequest.category = category;
        if (subCategory !== undefined) productRequest.subCategory = subCategory;
        if (brand !== undefined) productRequest.brand = brand;
        if (attributes) productRequest.attributes = attributes;
        if (inventory) productRequest.inventory = inventory;
        if (shipping) productRequest.shipping = shipping;
        if (isDigital !== undefined) productRequest.isDigital = isDigital;
        if (hasVariants !== undefined) productRequest.hasVariants = hasVariants;
        if (catalogId) productRequest.catalogId = catalogId;
        if (adminNotes !== undefined) productRequest.adminNotes = adminNotes;
        if (taxable !== undefined) productRequest.taxable = taxable;
        if (taxClass) productRequest.taxClass = taxClass;
        if (taxRate !== undefined) productRequest.taxRate = parseFloat(taxRate);
        
        // Add new images
        if (newProductImages.length > 0) {
            productRequest.images = [...productRequest.images, ...newProductImages];
        }
        
        // Set status to submitted if it was rejected
        if (productRequest.status === 'rejected') {
            productRequest.status = 'submitted';
        }
        
        await productRequest.save();
        
        // Log activity
        await ActivityLog.create({
            actorId: adminId,
            actorModel: 'Admins',
            action: 'product_request_updated',
            entityType: 'ProductRequest',
            entityId: productRequest._id,
            description: `Product request "${productRequest.name}" was updated by admin`,
            status: 'success'
        });
        
        // Create notification for Super Admins if request was resubmitted
        if (productRequest.status === 'submitted') {
            await Notification.create({
                title: 'Product Request Resubmitted',
                description: `Product request "${productRequest.name}" has been resubmitted`,
                type: 'product_request',
                forSuperAdmin: true,
                relatedTo: {
                    model: 'ProductRequest',
                    id: productRequest._id
                },
                priority: 'medium'
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Product request updated successfully",
            data: {
                _id: productRequest._id,
                name: productRequest.name,
                price: productRequest.price,
                status: productRequest.status
            }
        });
    } catch (error) {
        console.error("Error updating product request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Delete product request (Admin)
 */
const deleteProductRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.adminId;
        
        // Find product request
        const productRequest = await ProductRequest.findById(id);
        
        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }
        
        // Check if the product request belongs to the admin
        if (productRequest.adminId.toString() !== adminId) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to delete this product request"
            });
        }
        
        // Check if product request can be deleted
        if (!['draft', 'rejected'].includes(productRequest.status)) {
            return res.status(400).json({
                success: false,
                message: `Product request cannot be deleted in "${productRequest.status}" status`
            });
        }
        
        // Delete product request
        await ProductRequest.findByIdAndDelete(id);
        
        // Log activity
        await ActivityLog.create({
            actorId: adminId,
            actorModel: 'Admins',
            action: 'product_request_deleted',
            entityType: 'ProductRequest',
            entityId: id,
            description: `Product request "${productRequest.name}" was deleted by admin`,
            status: 'success'
        });
        
        res.status(200).json({
            success: true,
            message: "Product request deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting product request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Super Admin Functions
 */

/**
 * Get all product requests (Super Admin)
 */
const getAllProductRequests = async (req, res) => {
    try {
        const { status, adminId, limit = 20, page = 1, sort = 'createdAt', order = 'desc' } = req.query;
        
        // Build query
        const query = {};
        
        // Add status filter if provided
        if (status) {
            query.status = status;
        }
        
        // Add admin filter if provided
        if (adminId) {
            query.adminId = adminId;
        }
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === 'desc' ? -1 : 1;
        const sortOptions = {};
        sortOptions[sort] = sortOrder;
        
        // Get product requests with pagination
        const productRequests = await ProductRequest.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('adminId', 'first_name last_name email_id')
            .populate('catalogId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedProductId', 'name status');
        
        // Get total count for pagination
        const totalCount = await ProductRequest.countDocuments(query);
        
        res.status(200).json({
            success: true,
            message: "Product requests fetched successfully",
            data: {
                productRequests,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error("Error getting product requests:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get product request by ID (Super Admin)
 */
const getSuperAdminProductRequestById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find product request
        const productRequest = await ProductRequest.findById(id)
            .populate('adminId', 'first_name last_name email_id')
            .populate('catalogId', 'name')
            .populate('superAdminId', 'first_name last_name')
            .populate('publishedProductId', 'name status');
        
        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Product request fetched successfully",
            data: productRequest
        });
    } catch (error) {
        console.error("Error getting product request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Review product request (Super Admin)
 */
const reviewProductRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const superAdminId = req.superAdminId;
        const { status, superAdminNotes } = req.body;
        
        // Validate status
        if (!['approved', 'rejected', 'under_review'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'approved', 'rejected', or 'under_review'"
            });
        }
        
        // Find product request
        const productRequest = await ProductRequest.findById(id);
        
        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }
        
        // Check if product request is in a state that can be reviewed
        if (!['submitted', 'under_review'].includes(productRequest.status)) {
            return res.status(400).json({
                success: false,
                message: `Product request cannot be reviewed in "${productRequest.status}" status`
            });
        }
        
        // Require notes for rejection
        if (status === 'rejected' && !superAdminNotes) {
            return res.status(400).json({
                success: false,
                message: "Notes are required when rejecting a product request"
            });
        }
        
        // Update product request
        productRequest.status = status;
        productRequest.superAdminId = superAdminId;
        productRequest.reviewedAt = new Date();
        
        if (superAdminNotes !== undefined) {
            productRequest.superAdminNotes = superAdminNotes;
        }
        
        await productRequest.save();
        
        // Get admin details for notification
        const admin = await Admin.findById(productRequest.adminId);
        
        // Create notification for admin
        await Notification.create({
            title: `Product Request ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Under Review'}`,
            description: `Your product request "${productRequest.name}" has been ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'placed under review'}`,
            type: 'product_request',
            forAdmin: productRequest.adminId,
            relatedTo: {
                model: 'ProductRequest',
                id: productRequest._id
            },
            priority: 'high'
        });
        
        // Log activity
        await ActivityLog.create({
            actorId: superAdminId,
            actorModel: 'SuperAdmins',
            action: `product_request_${status}`,
            entityType: 'ProductRequest',
            entityId: productRequest._id,
            description: `Product request "${productRequest.name}" was ${status} by super admin`,
            status: 'success'
        });
        
        res.status(200).json({
            success: true,
            message: `Product request ${status} successfully`,
            data: {
                _id: productRequest._id,
                name: productRequest.name,
                status: productRequest.status
            }
        });
    } catch (error) {
        console.error("Error reviewing product request:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Publish product (Super Admin)
 */
const publishProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const superAdminId = req.superAdminId;
        const { 
            facebookRetailerId, 
            catalogId
        } = req.body;
        
        // Validate required fields
        if (!facebookRetailerId || !catalogId) {
            return res.status(400).json({
                success: false,
                message: "Facebook retailer ID and catalog ID are required"
            });
        }
        
        // Find product request
        const productRequest = await ProductRequest.findById(id);
        
        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }
        
        // Check if product request is approved
        if (productRequest.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: "Only approved product requests can be published"
            });
        }
        
        // Verify catalog exists
        const catalog = await ProductCatalog.findById(catalogId);
        if (!catalog) {
            return res.status(404).json({
                success: false,
                message: "Product catalog not found"
            });
        }
        
        // Create product
        const product = new Product({
            name: productRequest.name,
            description: productRequest.description,
            adminId: productRequest.adminId,
            price: productRequest.price,
            categoryId: productRequest.category,
            catalogId: catalogId,
            facebookProductId: facebookRetailerId,
            status: 'active',
            images: productRequest.images,
            productDetails: {
                brand: productRequest.brand,
                subCategory: productRequest.subCategory,
                attributes: productRequest.attributes,
                isDigital: productRequest.isDigital,
                hasVariants: productRequest.hasVariants,
                inventory: productRequest.inventory,
                shipping: productRequest.shipping,
                taxable: productRequest.taxable,
                taxClass: productRequest.taxClass,
                taxRate: productRequest.taxRate
            }
        });
        
        await product.save();
        
        // Update product request
        productRequest.status = 'published';
        productRequest.publishedAt = new Date();
        productRequest.publishedProductId = product._id;
        productRequest.facebookRetailerId = facebookRetailerId;
        
        await productRequest.save();
        
        // Update catalog's product count
        catalog.productCount = (catalog.productCount || 0) + 1;
        await catalog.save();
        
        // Get admin details for notification
        const admin = await Admin.findById(productRequest.adminId);
        
        // Create notification for admin
        await Notification.create({
            title: 'Product Published',
            description: `Your product "${productRequest.name}" has been published and is now active`,
            type: 'product_published',
            forAdmin: productRequest.adminId,
            relatedTo: {
                model: 'Product',
                id: product._id
            },
            priority: 'high'
        });
        
        // Log activity
        await ActivityLog.create({
            actorId: superAdminId,
            actorModel: 'SuperAdmins',
            action: 'product_published',
            entityType: 'Product',
            entityId: product._id,
            description: `Product "${product.name}" was published by super admin`,
            status: 'success'
        });
        
        res.status(200).json({
            success: true,
            message: "Product published successfully",
            data: {
                productRequest: {
                    _id: productRequest._id,
                    name: productRequest.name,
                    status: productRequest.status
                },
                product: {
                    _id: product._id,
                    name: product.name,
                    facebookRetailerId: product.facebookProductId,
                    status: product.status
                }
            }
        });
    } catch (error) {
        console.error("Error publishing product:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    // Admin endpoints
    createProductRequest,
    getAdminProductRequests,
    getProductRequestById,
    updateProductRequest,
    deleteProductRequest,
    
    // Super Admin endpoints
    getAllProductRequests,
    getSuperAdminProductRequestById,
    reviewProductRequest,
    publishProduct
};
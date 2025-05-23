// controllers/productRequestControllers.js
const { ProductRequest } = require('../models/ProductRequests');
const { ProductCatalog } = require('../models/ProductCatalogs');
const { Product } = require('../models/Products'); // Assuming you have a Products model
const { FileUpload } = require('../models/FileUploads');
const { getBucket } = require('../services/firebase');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');

const fs = require('fs').promises;
const os = require('os');

/**
 * Create a new product request with images uploaded to Firebase
 */
exports.createProductRequest = async (req, res) => {
    try {
        const adminId = req.adminId;
        const productData = req.body;

        // Debug info for uploaded files
        if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
                console.log(`File ${index + 1}:`, {
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    buffer: file.buffer ? 'Buffer present' : 'No buffer'
                });
            });
        } else {
            console.log('No files received with request');
        }

        // Validate required fields
        if (!productData.name || !productData.price) {
            return res.status(400).json({
                success: false,
                message: "Product name and price are required"
            });
        }

        // If catalogId is provided, verify it exists and belongs to the admin
        if (productData.catalogId) {
            const catalog = await ProductCatalog.findOne({
                _id: productData.catalogId,
                adminId: adminId
            });

            if (!catalog) {
                return res.status(404).json({
                    success: false,
                    message: "Catalog not found or you don't have access to it"
                });
            }
        }

        // Process uploaded files - USING bucket.upload() method to avoid stream issues
        let productImages = [];
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            try {
                // Get Firebase Storage bucket
                const bucket = getBucket();
                console.log(`Got Firebase bucket: ${bucket.name}`);
                
                for (const file of req.files) {
                    try {
                        // Generate unique filename
                        const fileExt = path.extname(file.originalname);
                        const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
                        
                        // Create folder structure by date: yyyy/mm/
                        const currentDate = new Date();
                        const year = currentDate.getFullYear();
                        const month = currentDate.getMonth() + 1;
                        
                        const filePath = `uploads/products/${year}/${month}/${filename}`;
                        
                        console.log(`Uploading product image to Firebase: ${filePath}`);
                        
                        // DIFFERENT APPROACH: Write to temp file first, then upload
                        const tempFilePath = path.join(os.tmpdir(), filename);
                        await fs.writeFile(tempFilePath, file.buffer);
                        
                        // Upload using bucket.upload() method instead of fileRef.save()
                        const [uploadedFile] = await bucket.upload(tempFilePath, {
                            destination: filePath,
                            metadata: {
                                contentType: file.mimetype,
                                metadata: {
                                    originalName: file.originalname,
                                    uploadedBy: adminId
                                }
                            },
                            public: true
                        });
                        
                        // Clean up temp file
                        try {
                            await fs.unlink(tempFilePath);
                        } catch (unlinkError) {
                            console.log('Could not delete temp file:', unlinkError.message);
                        }
                        
                        // Get public URL
                        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                        
                        console.log(`File uploaded successfully to Firebase: ${fileUrl}`);
                        
                        // Create file upload record
                        const fileUpload = await FileUpload.create({
                            filename,
                            originalFilename: file.originalname,
                            path: filePath,
                            url: fileUrl,
                            mimeType: file.mimetype,
                            size: file.size,
                            uploadedBy: {
                                id: adminId,
                                role: 'admin'
                            },
                            adminId,
                            entityType: 'product',
                            status: 'permanent',
                            isPublic: true,
                            bucket: bucket.name,
                            storageProvider: 'google_cloud',
                            storageMetadata: {
                                firebasePath: filePath
                            }
                        });
                        
                        productImages.push({
                            url: fileUrl,
                            isPrimary: productImages.length === 0,
                            caption: productData.imageCaptions && productData.imageCaptions[productImages.length] 
                              ? productData.imageCaptions[productImages.length] 
                              : null
                        });
                        
                    } catch (fileError) {
                        console.error("Error uploading file to Firebase:", fileError);
                        // Continue with other files
                    }
                }
            } catch (storageError) {
                console.error("Error with Firebase storage:", storageError);
                return res.status(500).json({
                    success: false,
                    message: "Error uploading files to storage",
                    error: storageError.message
                });
            }
        } else {
            console.log('No files to process');
        }

        console.log(`Successfully processed ${productImages.length} out of ${req.files ? req.files.length : 0} files`);

        // Create the product request
        const productRequest = new ProductRequest({
            adminId,
            name: productData.name,
            description: productData.description,
            price: parseFloat(productData.price),
            salePrice: productData.salePrice ? parseFloat(productData.salePrice) : null,
            currency: productData.currency || 'INR',
            category: productData.category || 'general',
            subCategory: productData.subCategory || null,
            brand: productData.brand || null,
            images: productImages,
            attributes: (() => {
                const attributesArray = [];
                let index = 0;
                
                while (productData[`attributes[${index}][name]`] !== undefined) {
                    const name = productData[`attributes[${index}][name]`];
                    const value = productData[`attributes[${index}][value]`];
                    
                    if (name && value) {
                        attributesArray.push({ name, value });
                    }
                    index++;
                }
                
                return attributesArray.length > 0 ? attributesArray : [];
            })(),
            inventory: {
                quantity: productData.quantity ? parseInt(productData.quantity) : 0,
                sku: productData.sku || null,
                managementType: productData.inventoryManagement || 'manual'
            },
            shipping: {
                weight: productData.weight ? parseFloat(productData.weight) : null,
                weightUnit: productData.weightUnit || 'g',
                dimensions: {
                    length: productData.length ? parseFloat(productData.length) : null,
                    width: productData.width ? parseFloat(productData.width) : null,
                    height: productData.height ? parseFloat(productData.height) : null,
                    unit: productData.dimensionUnit || 'cm'
                },
                shippingClass: productData.shippingClass || 'standard'
            },
            isDigital: productData.isDigital === 'true',
            hasVariants: productData.hasVariants === 'true',
            status: productData.status || 'draft',
            catalogId: productData.catalogId || null,
            adminNotes: productData.adminNotes || null,
            taxable: productData.taxable === 'true',
            taxClass: productData.taxClass || 'standard',
            taxRate: productData.taxRate ? parseFloat(productData.taxRate) : null
        });

        await productRequest.save();

        // Update file uploads with the product request ID
        if (productImages.length > 0) {
            const uploadedFiles = await FileUpload.find({
                adminId: adminId,
                entityType: 'product',
                url: { $in: productImages.map(img => img.url) }
            });
            
            if (uploadedFiles.length > 0) {
                await FileUpload.updateMany(
                    { _id: { $in: uploadedFiles.map(file => file._id) } },
                    { $set: { entityId: productRequest._id } }
                );
            }
        }

        res.status(201).json({
            success: true,
            message: "Product request created successfully",
            data: {
                _id: productRequest._id,
                name: productRequest.name,
                status: productRequest.status,
                createdAt: productRequest.createdAt,
                images: productImages
            },
            uploadStats: {
                totalFiles: req.files ? req.files.length : 0,
                successfulUploads: productImages.length,
                failedUploads: req.files ? req.files.length - productImages.length : 0
            }
        });
        
    } catch (error) {
        console.error("Error creating product request:", error);
        res.status(500).json({
            success: false,
            message: "Error creating product request",
            error: error.message
        });
    }
};

/**
 * Update a product request including handling image updates
 */
exports.updateProductRequest = async (req, res) => {
    try {
        const adminId = req.adminId;
        const productId = req.params.id;
        const updateData = req.body;
        const files = req.files;

        // Find the product request
        const productRequest = await ProductRequest.findOne({
            _id: productId,
            adminId: adminId
        });

        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found or you don't have access to it"
            });
        }

        // Check if product can be updated
        if (['approved', 'rejected', 'published'].includes(productRequest.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot update product in ${productRequest.status} status`
            });
        }

        // If catalogId is being updated, verify it exists and belongs to the admin
        if (updateData.catalogId && updateData.catalogId !== productRequest.catalogId?.toString()) {
            const catalog = await ProductCatalog.findOne({
                _id: updateData.catalogId,
                adminId: adminId
            });

            if (!catalog) {
                return res.status(404).json({
                    success: false,
                    message: "Catalog not found or you don't have access to it"
                });
            }
        }

        // Process new uploaded images - USING FIXED FIREBASE UPLOAD METHOD
        let newImages = [];
        if (files && Array.isArray(files) && files.length > 0) {
            try {
                // Get Firebase Storage bucket
                const bucket = getBucket();
                console.log(`Got Firebase bucket: ${bucket.name}`);
                
                for (const file of files) {
                    try {
                        // Generate unique filename
                        const fileExt = path.extname(file.originalname);
                        const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
                        
                        // Create folder structure by date: yyyy/mm/
                        const currentDate = new Date();
                        const year = currentDate.getFullYear();
                        const month = currentDate.getMonth() + 1;
                        
                        const filePath = `uploads/products/${year}/${month}/${filename}`;
                        
                        console.log(`Uploading product image to Firebase: ${filePath}`);
                        
                        // FIXED METHOD: Write to temp file first, then upload
                        const tempFilePath = path.join(os.tmpdir(), filename);
                        await fs.writeFile(tempFilePath, file.buffer);
                        
                        // Upload using bucket.upload() method instead of fileRef.save()
                        const [uploadedFile] = await bucket.upload(tempFilePath, {
                            destination: filePath,
                            metadata: {
                                contentType: file.mimetype,
                                metadata: {
                                    originalName: file.originalname,
                                    uploadedBy: adminId
                                }
                            },
                            public: true
                        });
                        
                        // Clean up temp file
                        try {
                            await fs.unlink(tempFilePath);
                        } catch (unlinkError) {
                            console.log('Could not delete temp file:', unlinkError.message);
                        }
                        
                        // Get public URL
                        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
                        
                        console.log(`File uploaded successfully to Firebase: ${fileUrl}`);
                        
                        // Create file upload record
                        const fileUpload = await FileUpload.create({
                            filename,
                            originalFilename: file.originalname,
                            path: filePath,
                            url: fileUrl,
                            mimeType: file.mimetype,
                            size: file.size,
                            uploadedBy: {
                                id: adminId,
                                role: 'admin'
                            },
                            adminId,
                            entityType: 'product',
                            entityId: productId, // Link to the product being updated
                            status: 'permanent',
                            isPublic: true,
                            bucket: bucket.name,
                            storageProvider: 'google_cloud',
                            storageMetadata: {
                                firebasePath: filePath
                            }
                        });
                        
                        // Add to new images array
                        newImages.push({
                            url: fileUrl,
                            isPrimary: false, // By default, new images are not primary
                            caption: updateData.newImageCaptions && updateData.newImageCaptions[newImages.length] 
                              ? updateData.newImageCaptions[newImages.length] 
                              : null
                        });
                        
                    } catch (fileError) {
                        console.error("Error uploading file to Firebase:", fileError);
                        // Continue with other files
                    }
                }
            } catch (storageError) {
                console.error("Error with Firebase storage:", storageError);
                return res.status(500).json({
                    success: false,
                    message: "Error uploading files to storage",
                    error: storageError.message
                });
            }
        }

        console.log(`Successfully processed ${newImages.length} new images`);

        // Handle existing images (keep, update, or remove)
        let finalImages = [];
        
        // If existingImages is provided as a stringified array, parse it
        let existingImages = [];
        if (updateData.existingImages) {
            try {
                existingImages = JSON.parse(updateData.existingImages);
            } catch (e) {
                console.warn("Could not parse existingImages:", e);
                // Fallback to empty array if parsing fails
                existingImages = [];
            }
        }
        
        if (existingImages && Array.isArray(existingImages) && existingImages.length > 0) {
            // Filter out images that are being kept
            finalImages = productRequest.images.filter(img => 
                existingImages.some(existImg => existImg.url === img.url)
            );
            
            // Update captions and isPrimary status for existing images
            finalImages = finalImages.map(img => {
                const updatedImg = existingImages.find(existImg => existImg.url === img.url);
                return {
                    url: img.url,
                    isPrimary: updatedImg.isPrimary || img.isPrimary,
                    caption: updatedImg.caption || img.caption
                };
            });
        } else if (updateData.removeAllImages !== 'true') {
            // No explicit instructions about existing images and not removing all, keep them all
            finalImages = [...productRequest.images];
        }
        
        // Add new images
        finalImages = [...finalImages, ...newImages];
        
        // Ensure there's a primary image if any images exist
        if (finalImages.length > 0 && !finalImages.some(img => img.isPrimary)) {
            finalImages[0].isPrimary = true;
        }

        // Prepare update object with proper type conversion
        const productUpdateData = {
            name: updateData.name,
            description: updateData.description,
            price: updateData.price ? parseFloat(updateData.price) : productRequest.price,
            salePrice: updateData.salePrice ? parseFloat(updateData.salePrice) : productRequest.salePrice,
            currency: updateData.currency || productRequest.currency,
            category: updateData.category || productRequest.category,
            subCategory: updateData.subCategory || productRequest.subCategory,
            brand: updateData.brand || productRequest.brand,
            images: finalImages,
            status: updateData.status || productRequest.status,
            catalogId: updateData.catalogId || productRequest.catalogId,
            adminNotes: updateData.adminNotes || productRequest.adminNotes,
            isDigital: updateData.isDigital === 'true',
            hasVariants: updateData.hasVariants === 'true',
            taxable: updateData.taxable === 'true',
            taxClass: updateData.taxClass || productRequest.taxClass,
            taxRate: updateData.taxRate ? parseFloat(updateData.taxRate) : productRequest.taxRate
        };

        // Handle nested objects
        if (updateData.quantity || updateData.sku || updateData.inventoryManagement) {
            productUpdateData.inventory = {
                quantity: updateData.quantity ? parseInt(updateData.quantity) : productRequest.inventory.quantity,
                sku: updateData.sku || productRequest.inventory.sku,
                managementType: updateData.inventoryManagement || productRequest.inventory.managementType
            };
        }

        if (updateData.weight || updateData.weightUnit || 
            updateData.length || updateData.width || updateData.height || 
            updateData.dimensionUnit || updateData.shippingClass) {
            
            productUpdateData.shipping = {
                weight: updateData.weight ? parseFloat(updateData.weight) : productRequest.shipping.weight,
                weightUnit: updateData.weightUnit || productRequest.shipping.weightUnit,
                dimensions: {
                    length: updateData.length ? parseFloat(updateData.length) : productRequest.shipping.dimensions.length,
                    width: updateData.width ? parseFloat(updateData.width) : productRequest.shipping.dimensions.width,
                    height: updateData.height ? parseFloat(updateData.height) : productRequest.shipping.dimensions.height,
                    unit: updateData.dimensionUnit || productRequest.shipping.dimensions.unit
                },
                shippingClass: updateData.shippingClass || productRequest.shipping.shippingClass
            };
        }

        // Handle attributes - support both JSON string and form-data format
        if (updateData.attributes) {
            try {
                if (typeof updateData.attributes === 'string') {
                    productUpdateData.attributes = JSON.parse(updateData.attributes);
                } else {
                    productUpdateData.attributes = updateData.attributes;
                }
            } catch (e) {
                console.warn("Could not parse attributes, trying form-data format");
                // Try form-data format like attributes[0][name], attributes[0][value]
                const attributesArray = [];
                let index = 0;
                
                while (updateData[`attributes[${index}][name]`] !== undefined) {
                    const name = updateData[`attributes[${index}][name]`];
                    const value = updateData[`attributes[${index}][value]`];
                    
                    if (name && value) {
                        attributesArray.push({ name, value });
                    }
                    index++;
                }
                
                productUpdateData.attributes = attributesArray.length > 0 ? attributesArray : productRequest.attributes;
            }
        }

        // Update product request - use findByIdAndUpdate for atomicity
        const updatedProductRequest = await ProductRequest.findByIdAndUpdate(
            productId,
            { $set: productUpdateData },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Product request updated successfully",
            productRequest: updatedProductRequest,
            uploadStats: {
                newFilesProcessed: files ? files.length : 0,
                successfulUploads: newImages.length,
                failedUploads: files ? files.length - newImages.length : 0,
                totalImages: finalImages.length
            }
        });
    } catch (error) {
        console.error("Update product request error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating product request",
            error: error.message
        });
    }
};

/**
 * Delete a product request
 */
exports.deleteProductRequest = async (req, res) => {
    try {
        const adminId = req.adminId;
        const productId = req.params.id;

        // Find the product request
        const productRequest = await ProductRequest.findOne({
            _id: productId,
            adminId: adminId
        });

        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found or you don't have access to it"
            });
        }

        // Check if product can be deleted
        if (['approved', 'published'].includes(productRequest.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete product in ${productRequest.status} status`
            });
        }

        // Delete the product request
        await ProductRequest.findByIdAndDelete(productId);

        res.status(200).json({
            success: true,
            message: "Product request deleted successfully"
        });
    } catch (error) {
        console.error("Delete product request error:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting product request",
            error: error.message
        });
    }
};

/**
 * Get all product requests for an admin
 */
exports.getAdminProductRequests = async (req, res) => {
    try {
        const adminId = req.adminId;
        const { status, page = 1, limit = 10, sort = 'createdAt', order = 'desc', search } = req.query;

        // Build query
        const query = { adminId };
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        // Add text search if provided
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Sort order
        const sortObj = {};
        sortObj[sort] = order === 'asc' ? 1 : -1;

        // Get total count for pagination
        const total = await ProductRequest.countDocuments(query);
        
        // Get product requests with pagination and sorting
        const productRequests = await ProductRequest.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('catalogId', 'name');

        res.status(200).json({
            success: true,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            productRequests
        });
    } catch (error) {
        console.error("Get admin product requests error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching product requests",
            error: error.message
        });
    }
};

/**
 * Get a specific product request by ID for an admin
 */
exports.getProductRequestById = async (req, res) => {
    try {
        const adminId = req.adminId;
        const productId = req.params.id;

        // Find the product request
        const productRequest = await ProductRequest.findOne({
            _id: productId,
            adminId: adminId
        }).populate('catalogId', 'name');

        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found or you don't have access to it"
            });
        }

        res.status(200).json({
            success: true,
            productRequest
        });
    } catch (error) {
        console.error("Get product request by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching product request",
            error: error.message
        });
    }
};

// SuperAdmin methods

/**
 * Get all product requests for superadmin
 */
exports.getAllProductRequests = async (req, res) => {
    try {
        const { status, adminId, page = 1, limit = 10, sort = 'createdAt', order = 'desc', search } = req.query;

        // Build query
        const query = {};
        
        // Filter by status if provided
        if (status) {
            query.status = status;
        }
        
        // Filter by adminId if provided
        if (adminId) {
            query.adminId = adminId;
        }
        
        // Add text search if provided
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Sort order
        const sortObj = {};
        sortObj[sort] = order === 'asc' ? 1 : -1;

        // Get total count for pagination
        const total = await ProductRequest.countDocuments(query);
        
        // Get product requests with pagination and sorting
        const productRequests = await ProductRequest.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit))
            .populate('adminId', 'name email businessName')
            .populate('catalogId', 'name');

        res.status(200).json({
            success: true,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            productRequests
        });
    } catch (error) {
        console.error("Get all product requests error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching product requests",
            error: error.message
        });
    }
};

/**
 * Get a specific product request by ID for superadmin
 */
exports.getSuperAdminProductRequestById = async (req, res) => {
    try {
        const productId = req.params.id;

        // Find the product request
        const productRequest = await ProductRequest.findById(productId)
            .populate('adminId', 'name email businessName')
            .populate('catalogId', 'name')
            .populate('superAdminId', 'name email');

        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }

        res.status(200).json({
            success: true,
            productRequest
        });
    } catch (error) {
        console.error("Get product request by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching product request",
            error: error.message
        });
    }
};

/**
 * Review a product request (approve/reject) by superadmin
 */
exports.reviewProductRequest = async (req, res) => {
    try {
        const superAdminId = req.superAdminId;
        const productId = req.params.id;
        const { status, superAdminNotes } = req.body;

        // Validate status
        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Status must be 'approved' or 'rejected'"
            });
        }

        // Find the product request
        const productRequest = await ProductRequest.findById(productId);

        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }

        // Check if product is in a reviewable state
        if (productRequest.status !== 'submitted' && productRequest.status !== 'under_review') {
            return res.status(400).json({
                success: false,
                message: `Cannot review product in ${productRequest.status} status. Product must be in 'submitted' or 'under_review' status`
            });
        }

        // Update product request
        productRequest.status = status;
        productRequest.superAdminId = superAdminId;
        productRequest.superAdminNotes = superAdminNotes || null;
        productRequest.reviewedAt = new Date();
        
        // If status is rejected, add rejection reason
        if (status === 'rejected') {
            productRequest.rejectionReason = req.body.rejectionReason || 'Product request was rejected';
        }

        // Save updates
        await productRequest.save();

        res.status(200).json({
            success: true,
            message: `Product request ${status} successfully`,
            productRequest
        });
    } catch (error) {
        console.error("Review product request error:", error);
        res.status(500).json({
            success: false,
            message: "Error reviewing product request",
            error: error.message
        });
    }
};

/**
 * Publish an approved product to the catalog
 */
exports.publishProduct = async (req, res) => {
    try {
        const superAdminId = req.superAdminId;
        const productId = req.params.id;

        // Find the product request
        const productRequest = await ProductRequest.findById(productId);

        if (!productRequest) {
            return res.status(404).json({
                success: false,
                message: "Product request not found"
            });
        }

        // Check if product is approved and not already published
        if (productRequest.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: "Only approved products can be published"
            });
        }

        // Check if catalog exists
        if (!productRequest.catalogId) {
            return res.status(400).json({
                success: false,
                message: "Product must be associated with a catalog to be published"
            });
        }

        // Create new product in Products collection
        const product = new Product({
            name: productRequest.name,
            description: productRequest.description,
            price: productRequest.price,
            salePrice: productRequest.salePrice,
            currency: productRequest.currency,
            category: productRequest.category,
            subCategory: productRequest.subCategory,
            brand: productRequest.brand,
            images: productRequest.images,
            attributes: productRequest.attributes,
            inventory: productRequest.inventory,
            shipping: productRequest.shipping,
            isDigital: productRequest.isDigital,
            hasVariants: productRequest.hasVariants,
            status: 'active',
            catalogId: productRequest.catalogId,
            adminId: productRequest.adminId,
            superAdminId: superAdminId,
            productRequestId: productRequest._id,
            taxable: productRequest.taxable,
            taxClass: productRequest.taxClass,
            taxRate: productRequest.taxRate
        });

        // Save the new product
        await product.save();

        // Update the product request status and reference to published product
        productRequest.status = 'published';
        productRequest.publishedAt = new Date();
        productRequest.publishedProductId = product._id;
        await productRequest.save();

        // Update product count in catalog
        await ProductCatalog.findByIdAndUpdate(
            productRequest.catalogId,
            { $inc: { productCount: 1 } }
        );

        res.status(200).json({
            success: true,
            message: "Product published successfully",
            product,
            productRequest
        });
    } catch (error) {
        console.error("Publish product error:", error);
        res.status(500).json({
            success: false,
            message: "Error publishing product",
            error: error.message
        });
    }
};
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require("dotenv").config(); // For reading credentials from .env
const{SuperAdmin} = require('../models/SuperAdmins');
const{SuperAdminTokens} = require('../models/SuperAdminTokens');
const {Admin} = require('../models/Admins');
const { User } = require('../models/Users');


/**
 * ✅ Register Super Admin
 */
const register = async (req, res) =>{
    SuperAdmin.find({email_id: req.body.email_id}).exec().then((superAdmin) => {
        if(superAdmin.length >=1){
            return res.status(401).json({
                success: false,
                message: "Email ID already exists"
            })
        }else{
                bcrypt.hash(req.body.password, 2, (err, hash) => {
                    if(err){
                        return res.status(500).json({
                            success: false,
                            message: "Error, cannot encrypt password"
                        })
                        }else{
                            const superAdmin = new SuperAdmin({
                                first_name: req.body.first_name,
                                last_name: req.body.last_name,
                                mobile: req.body.mobile,
                                email_id: req.body.email_id,
                                password: hash,
                            });
                            superAdmin.save().then(() => {   
                                res.send({
                                    success: true,
                                    message : "Super Admin Registered Successfully"
                                });
                            }).catch((e) => {
                                res.send({
                                    success: true,
                                    message: "Internal Server Error",
                                    error:e
                                });
                            })
                        }
                    }
                )
            }
        }
    )
}

/**
 * ✅ Login Super Admin
 */
const login = async (req, res, next) => {
    SuperAdmin.findOne({email_id: req.body.email_id}).exec()
    .then((superAdmin) => {
        if(!superAdmin){
            return res.status(401).json({
                success: false,
                message: "Super admin not found"
            })
        }
        bcrypt.compare(req.body.password, superAdmin.password, async (err, result) => {
            if(err){
                return res.status(401).json({
                    success: false,
                    message: "Server error, authentication failed"
                })
            }
            if(result){
                const token = jwt.sign(
                    {
                        email_id: superAdmin.email_id,
                        superAdminId: superAdmin._id
                    },
                    process.env.JWT_SECRET,
                    // {
                    //     expiresIn: "2h"
                    // }
                );
                
                await SuperAdminTokens.findOneAndUpdate({superAdminId: superAdmin._id, tokenType: "login"}, {token: token}, {new: true, upsert: true})
                return res.status(200).json({
                    success: true,
                    message: "Login successfully!",
                    data: {
                        token,
                        superAdmin
                    }
                })
                
            }
            return res.status(401).json({
                success: false,
                message: "Wrong password, login failed"
            })
        })
    })
    .catch((err) => {
        res.status(500).json({
            success: false,
            message: "Server error, authentication failed"
        })
    })
}

/**
 * ✅ Logout Super Admin
 */
const logout = async (req, res) => {
    // Delete the session token or access token associated with the admin
    const superAdmin = await SuperAdmin.findById(req.superAdminId);
    // console.log(admin._id)
    const logout = await SuperAdminTokens.findOneAndUpdate({superAdminId : superAdmin._id},
        // console.log(logout.token)
        {
            $set: {
                token : null
            }}
        ).then(result=>{
            res.status(200).json({
                success: true,
                message : "Super Admin Logged Out Successfully"
        })
    })
    .catch(err=>{
        // console.log(err);
        res.status(500).json({
            success: false,
            message : "Internal Serval error",
            error:err
        })
    })
}

//Update profile of an admin
const updateProfile = async (req, res) => {
    Admin.findOne()
    .then(result => {
        res.status(200).json({
            success: true,
            message: "All Profiles fetched successfully",
            data:result
        })
    })
    .catch(err=>{
        // console.log(err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error:err
        })
    })
}

//Profile of particular Admin
const getProfile = async (req, res) => {
    SuperAdmin.findOne({_id:req.superAdminId})
    .then(result => {
        res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data:result
        })
    })
    .catch(err=>{
        // console.log(err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error:err
        })
    })
}

/**
 * ✅ Change Password
 */
const changePassword = async (req, res) => {
    try {
        const _id = req.superAdminId;  // Assuming req.superAdminId is set from middleware after token verification
        const { password, newPassword } = req.body;
        
        // Validate request body
        if (!password || !newPassword) {
            return res.status(400).json({success: false, message: 'Please provide both current and new passwords.' });
        }

        // Find super admin by ID
        const superAdmin = await SuperAdmin.findById(_id);
        if (!superAdmin) {
            return res.status(404).json({ success: false, message: 'Super Admin not found.' });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(password, superAdmin.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: 'Invalid current password.' });
        }

        // Generate a new hashed password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update the admin's password
        superAdmin.password = hashedPassword;
        await superAdmin.save();
        
        // Generate a new JWT token
        const token = jwt.sign(
            { _id: superAdmin._id }, 
            process.env.JWT_SECRET
            // { expiresIn: '1h' }  // Token will expire in 1 hour
        );

        // Send success response
        res.status(200).json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (error) {
        // console.error('Error changing password:', error);
        res.status(500).json({ success: false,message: 'An error occurred while changing the password.', error: error });
    }
};

/**
 * ✅ Update Admin status
 */
const updateAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (typeof status !== "boolean") {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const user = await Admin.findByIdAndUpdate(id, { status }, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            message: "Admin status updated successfully",
            data: user
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error", error: error });
    }
};

/**
 * ✅ Get All Admins
 */
const getAllAdmins = async (req, res) => {
    try {
        const admin = await Admin.find()

        res.status(200).json({
            success: true,
            message: "Admin list fetched successfully",
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error
        });
    }
};

/**
 * ✅ Get All Admins
 */
const getAdminById = async (req, res) => {
    try {
        const admin = await Admin.find(req.params.id)

        res.status(200).json({
            success: true,
            message: "Admin details fetched successfully",
            data: admin
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error
        });
    }
};

/**
 * ✅ Get All Users
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({adminId:req.params.id})

        res.status(200).json({
            success: true,
            message: "Users list fetched successfully",
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error
        });
    }
};

/**
 * ✅ Get Particular User
 */
const getUserById = async (req, res) => {
    try {
        const users = await User.findById(req.params.id)

        res.status(200).json({
            success: true,
            message: "User details fetched successfully",
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error
        });
    }
};



module.exports={
    register,
    login,
    updateProfile,
    getProfile,
    changePassword,
    logout,
    getAllUsers,
    getAllAdmins,
    updateAdminStatus,
    getAdminById,
    getUserById
}
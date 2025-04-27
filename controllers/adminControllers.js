const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require("dotenv").config(); // For reading credentials from .env
const{Admin} = require('../models/Admins');
const{AdminTokens} = require('../models/adminTokens');
const {User} = require('../models/Users');


/**
 * ✅ Register Admin
 */
const register = async (req, res) =>{
    Admin.find({email_id: req.body.email_id}).exec().then((admin) => {
        if(admin.length >=1){
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
                            const admin = new Admin({
                                first_name: req.body.first_name,
                                last_name: req.body.last_name,
                                mobile: req.body.mobile,
                                email_id: req.body.email_id,
                                password: hash,
                            });
                            admin.save().then(() => {   
                                res.send({
                                    success: true,
                                    message : "Admin Registered Successfully"
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
 * ✅ Login Admin
 */
const login = async (req, res, next) => {
    Admin.findOne({email_id: req.body.email_id}).exec()
    .then((admin) => {
        if(!admin){
            return res.status(401).json({
                success: false,
                message: "Admin not found"
            })
        }
        bcrypt.compare(req.body.password, admin.password, async (err, result) => {
            if(err){
                return res.status(401).json({
                    success: false,
                    message: "Server error, authentication failed"
                })
            }
            if(result){
                const token = jwt.sign(
                    {
                        email_id: admin.email_id,
                        adminId: admin._id
                    },
                    process.env.JWT_SECRET,
                    // {
                    //     expiresIn: "2h"
                    // }
                );
                
                await AdminTokens.findOneAndUpdate({adminId: admin._id, tokenType: "login"}, {token: token}, {new: true, upsert: true})
                return res.status(200).json({
                    success: true,
                    message: "Login successfully!",
                    data: {
                        token,
                        admin
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
 * ✅ Logout Admin
 */
const logout = async (req, res) => {
    // Delete the session token or access token associated with the admin
    const admin = await Admin.findById(req.adminId);
    // console.log(admin._id)
    const logout = await AdminTokens.findOneAndUpdate({adminId : admin._id},
        // console.log(logout.token)
        {
            $set: {
                token : null
            }}
        ).then(result=>{
            res.status(200).json({
                success: true,
                message : "Admin Logged Out Successfully"
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

//Profile of a Particular Admin
const Profile = async (req, res) => {
    Admin.findOne({_id:req.adminId})
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
 * ✅ Update Admin Profile
 */
const updateProfile = async (req, res) => {
    Admin.findOneAndUpdate({_id:req.adminId},{
        $set:{
            first_name: req.body.first_name,
            last_name: req.body.last_name,
            mobile: req.body.mobile
        }
    })
    .then(result=>{
        res.status(200).json({
            success: true,
            message : "admin profile updated successfully"
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
        const _id = req.adminId;  // Assuming req.adminId is set from middleware after token verification
        const { password, newPassword } = req.body;
        
        // Validate request body
        if (!password || !newPassword) {
            return res.status(400).json({success: false, message: 'Please provide both current and new passwords.' });
        }

        // Find admin by ID
        const admin = await Admin.findById(_id);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found.' });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: 'Invalid current password.' });
        }

        // Generate a new hashed password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update the admin's password
        admin.password = hashedPassword;
        await admin.save();
        
        // Generate a new JWT token
        const token = jwt.sign(
            { _id: admin._id }, 
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
 * ✅ Update user status
 */
const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (typeof status !== "boolean") {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const user = await User.findByIdAndUpdate(id, { status }, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            message: "User status updated successfully",
            data: user
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error", error: error });
    }
};

/**
 * ✅ Get All Users
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()

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
    Profile,
    updateProfile,
    changePassword,
    logout,
    getAllUsers,
    updateUserStatus,
    getUserById
}
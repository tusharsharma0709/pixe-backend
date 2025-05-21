// services/firebase.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Get Firebase Storage bucket
 * @returns {Bucket} Firebase Storage bucket
 */
const getBucket = () => {
    // Check if Firebase is already initialized
    if (!admin.apps.length) {
        console.log('Initializing Firebase Admin SDK...');
        
        try {
            // If service account file exists, use it
            const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
            
            if (fs.existsSync(serviceAccountPath)) {
                // Use service account file
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "pixe-whatsapp.firebasestorage.app"
                });
                console.log('Firebase initialized with service account file');
            } else {
                // Use environment variables
                if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
                    throw new Error('Firebase environment variables are missing');
                }
                
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID || "pixe-whatsapp",
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                    }),
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "pixe-whatsapp.firebasestorage.app"
                });
                console.log('Firebase initialized with environment variables');
            }
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw new Error(`Failed to initialize Firebase: ${error.message}`);
        }
    }
    
    // Get and return the bucket
    try {
        return admin.storage().bucket();
    } catch (error) {
        console.error('Error getting Firebase bucket:', error);
        throw new Error(`Failed to get Firebase bucket: ${error.message}`);
    }
};

module.exports = {
    admin,
    getBucket
};
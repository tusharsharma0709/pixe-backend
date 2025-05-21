// services/firebase.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// services/firebase.js
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
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
                });
                console.log('Firebase initialized with service account file');
            } else {
                // Use environment variables
                if (!process.env.FIREBASE_PROJECT_ID) {
                    console.error('Missing FIREBASE_PROJECT_ID');
                }
                if (!process.env.FIREBASE_CLIENT_EMAIL) {
                    console.error('Missing FIREBASE_CLIENT_EMAIL');
                }
                if (!process.env.FIREBASE_PRIVATE_KEY) {
                    console.error('Missing FIREBASE_PRIVATE_KEY');
                }
                if (!process.env.FIREBASE_STORAGE_BUCKET) {
                    console.error('Missing FIREBASE_STORAGE_BUCKET');
                }
                
                if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
                    throw new Error('Firebase environment variables are missing');
                }
                
                // Print first few characters of private key for debugging
                const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
                console.log(`Private key starts with: ${privateKey.substring(0, 20)}...`);
                
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: privateKey
                    }),
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
                });
                console.log('Firebase initialized with environment variables');
                console.log(`Using storage bucket: ${process.env.FIREBASE_STORAGE_BUCKET}`);
            }
        } catch (error) {
            console.error('Firebase initialization error:', error);
            throw new Error(`Failed to initialize Firebase: ${error.message}`);
        }
    }
    
    // Get and return the bucket
    try {
        const bucket = admin.storage().bucket();
        console.log(`Got Firebase bucket: ${bucket.name}`);
        return bucket;
    } catch (error) {
        console.error('Error getting Firebase bucket:', error);
        throw new Error(`Failed to get Firebase bucket: ${error.message}`);
    }
};

module.exports = {
    admin,
    getBucket
};
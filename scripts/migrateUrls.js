// scripts/migrateUrls.js
const mongoose = require('mongoose');
const { FileUpload } = require('../models/FileUploads');
const { CampaignRequest } = require('../models/CampaignRequests');
require('dotenv').config();

const migrateUrls = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Determine target URL format
    const useRelativeUrls = process.env.USE_RELATIVE_URLS === 'true';
    
    // Update FileUpload URLs
    console.log('Updating FileUpload URLs...');
    const fileUploads = await FileUpload.find();
    let fileUpdatesCount = 0;
    
    for (const file of fileUploads) {
      let newUrl = file.url;
      
      if (useRelativeUrls && file.url.includes('storage.googleapis.com')) {
        // Convert Firebase URL to relative URL
        const match = file.url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
        if (match) {
          newUrl = `/${match[1]}`;
        }
      } else if (!useRelativeUrls && file.url.startsWith('/')) {
        // Convert relative URL to absolute URL
        const baseUrl = process.env.APP_URL || 'https://yourdomain.com';
        newUrl = `${baseUrl}${file.url}`;
      }
      
      if (newUrl !== file.url) {
        file.url = newUrl;
        await file.save();
        fileUpdatesCount++;
      }
    }
    console.log(`Updated ${fileUpdatesCount} file URLs`);
    
    // Update Campaign Request imageUrls
    console.log('Updating Campaign Request imageUrls...');
    const campaignRequests = await CampaignRequest.find();
    let campaignUpdatesCount = 0;
    
    for (const request of campaignRequests) {
      let updated = false;
      
      if (request.creatives && Array.isArray(request.creatives)) {
        for (const creative of request.creatives) {
          if (creative.imageUrls && Array.isArray(creative.imageUrls)) {
            for (let i = 0; i < creative.imageUrls.length; i++) {
              const url = creative.imageUrls[i];
              
              if (typeof url === 'string') {
                let newUrl = url;
                
                if (useRelativeUrls && url.includes('storage.googleapis.com')) {
                  // Convert Firebase URL to relative URL
                  const match = url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
                  if (match) {
                    newUrl = `/${match[1]}`;
                  }
                } else if (!useRelativeUrls && url.startsWith('/')) {
                  // Convert relative URL to absolute URL
                  const baseUrl = process.env.APP_URL || 'https://yourdomain.com';
                  newUrl = `${baseUrl}${url}`;
                }
                
                if (newUrl !== url) {
                  creative.imageUrls[i] = newUrl;
                  updated = true;
                }
              }
            }
          }
        }
      }
      
      if (updated) {
        await request.save();
        campaignUpdatesCount++;
      }
    }
    console.log(`Updated ${campaignUpdatesCount} campaign requests`);
    
    console.log('URL migration completed successfully');
  } catch (error) {
    console.error('Error during URL migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

migrateUrls();
// middleware/urlTransformer.js
const urlTransformer = (req, res, next) => {
    // Get the original json method
    const originalJson = res.json;
    
    // Override the json method
    res.json = function(obj) {
      // Skip if no object or not an API route
      if (!obj || !req.path.startsWith('/api')) {
        return originalJson.call(this, obj);
      }
      
      try {
        // Copy the object to avoid modifying the original
        const copy = JSON.parse(JSON.stringify(obj));
        
        // Transform URLs in the copy (non-recursive approach)
        if (copy.data && Array.isArray(copy.data)) {
          for (let i = 0; i < copy.data.length; i++) {
            const item = copy.data[i];
            // Transform url if present
            if (item && item.url && typeof item.url === 'string') {
              if (process.env.USE_RELATIVE_URLS === 'true' && item.url.includes('storage.googleapis.com')) {
                const match = item.url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
                if (match) {
                  copy.data[i].url = `/${match[1]}`;
                }
              } else if (process.env.USE_RELATIVE_URLS !== 'true' && item.url.startsWith('/')) {
                const baseUrl = process.env.APP_URL || `http://${req.get('host')}`;
                copy.data[i].url = `${baseUrl}${item.url}`;
              }
            }
            
            // Transform imageUrls if present
            if (item && item.creatives && Array.isArray(item.creatives)) {
              for (let j = 0; j < item.creatives.length; j++) {
                const creative = item.creatives[j];
                if (creative && creative.imageUrls && Array.isArray(creative.imageUrls)) {
                  for (let k = 0; k < creative.imageUrls.length; k++) {
                    const url = creative.imageUrls[k];
                    if (typeof url === 'string') {
                      if (process.env.USE_RELATIVE_URLS === 'true' && url.includes('storage.googleapis.com')) {
                        const match = url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
                        if (match) {
                          copy.data[i].creatives[j].imageUrls[k] = `/${match[1]}`;
                        }
                      } else if (process.env.USE_RELATIVE_URLS !== 'true' && url.startsWith('/')) {
                        const baseUrl = process.env.APP_URL || `http://${req.get('host')}`;
                        copy.data[i].creatives[j].imageUrls[k] = `${baseUrl}${url}`;
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // If there's a single object with url
        if (copy.url && typeof copy.url === 'string') {
          if (process.env.USE_RELATIVE_URLS === 'true' && copy.url.includes('storage.googleapis.com')) {
            const match = copy.url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
            if (match) {
              copy.url = `/${match[1]}`;
            }
          } else if (process.env.USE_RELATIVE_URLS !== 'true' && copy.url.startsWith('/')) {
            const baseUrl = process.env.APP_URL || `http://${req.get('host')}`;
            copy.url = `${baseUrl}${copy.url}`;
          }
        }
        
        // Return the transformed object
        return originalJson.call(this, copy);
      } catch (error) {
        console.error('Error in URL Transformer:', error);
        // In case of error, return the original object
        return originalJson.call(this, obj);
      }
    };
    
    next();
  };
  
  module.exports = urlTransformer;
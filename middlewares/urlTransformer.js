// middleware/urlTransformer.js
/**
 * Middleware to ensure consistent URLs in API responses
 */
const urlTransformer = (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(obj) {
      // Process the response object to ensure URL consistency
      const transformObject = (data) => {
        if (!data) return data;
        
        // Handle arrays
        if (Array.isArray(data)) {
          return data.map(item => transformObject(item));
        }
        
        // Handle objects
        if (typeof data === 'object') {
          // Transform known URL fields
          if (data.url && typeof data.url === 'string') {
            // If using relative URLs in a full URL environment, convert to relative
            if (process.env.USE_RELATIVE_URLS === 'true' && data.url.includes('storage.googleapis.com')) {
              const match = data.url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
              if (match) {
                data.url = `/${match[1]}`;
              }
            }
            // If using full URLs in a relative URL environment, convert to full
            else if (process.env.USE_RELATIVE_URLS !== 'true' && data.url.startsWith('/')) {
              const baseUrl = process.env.APP_URL || `http://${req.get('host')}`;
              data.url = `${baseUrl}${data.url}`;
            }
          }
          
          // Handle imageUrls arrays in creatives
          if (data.creatives && Array.isArray(data.creatives)) {
            data.creatives = data.creatives.map(creative => {
              if (creative.imageUrls && Array.isArray(creative.imageUrls)) {
                creative.imageUrls = creative.imageUrls.map(url => {
                  if (typeof url === 'string') {
                    // Apply the same transformations as above
                    if (process.env.USE_RELATIVE_URLS === 'true' && url.includes('storage.googleapis.com')) {
                      const match = url.match(/storage\.googleapis\.com\/[^\/]+\/(.+)/);
                      if (match) {
                        return `/${match[1]}`;
                      }
                    } else if (process.env.USE_RELATIVE_URLS !== 'true' && url.startsWith('/')) {
                      const baseUrl = process.env.APP_URL || `http://${req.get('host')}`;
                      return `${baseUrl}${url}`;
                    }
                  }
                  return url;
                });
              }
              return creative;
            });
          }
          
          // Process nested objects
          for (const key in data) {
            if (data.hasOwnProperty(key) && typeof data[key] === 'object' && data[key] !== null) {
              data[key] = transformObject(data[key]);
            }
          }
        }
        
        return data;
      };
      
      // Transform the response object
      const transformedObj = transformObject(obj);
      
      // Call the original json method
      return originalJson.call(this, transformedObj);
    };
    
    next();
  };
  
  module.exports = urlTransformer;
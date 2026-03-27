const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const sharp = require('sharp');
const logger = require('./logger');

class CloudinaryStorage {
    constructor() {
        this.isInitialized = false;
    }

    initialize() {
        try {
            // Configure Cloudinary
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true
            });
            
            this.isInitialized = true;
            logger.info('☁️ Cloudinary storage initialized successfully');
            logger.info(`📁 Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
        } catch (error) {
            logger.error(`Failed to initialize Cloudinary: ${error.message}`);
            throw error;
        }
    }

    async uploadScreenshot(imageUrl, matchId, screenshotIndex) {
        try {
            // Download the image from Discord CDN
            const response = await axios({
                method: 'GET',
                url: imageUrl,
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; MLHubBot/1.0)'
                }
            });

            // Get image buffer
            let imageBuffer = Buffer.from(response.data);
            
            // Compress image if too large (max 1MB)
            let originalSize = imageBuffer.length;
            if (imageBuffer.length > 1024 * 1024) {
                imageBuffer = await sharp(imageBuffer)
                    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                logger.info(`Image compressed: ${(originalSize / 1024).toFixed(2)} KB -> ${(imageBuffer.length / 1024).toFixed(2)} KB`);
            }

            // Convert buffer to base64
            const base64Image = imageBuffer.toString('base64');
            const dataUri = `data:image/jpeg;base64,${base64Image}`;

            // Upload to Cloudinary
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload(dataUri, {
                    folder: `ml-hub-bot/matches/${matchId}`,
                    public_id: `screenshot_${screenshotIndex}_${Date.now()}`,
                    transformation: [
                        { quality: "auto:good" },
                        { fetch_format: "auto" }
                    ],
                    context: {
                        match_id: matchId,
                        uploaded_by: "ml-hub-bot",
                        uploaded_at: new Date().toISOString()
                    }
                }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });

            const imageUrl_ = uploadResult.secure_url;
            logger.info(`Screenshot uploaded to Cloudinary: ${imageUrl_}`);
            logger.info(`Public ID: ${uploadResult.public_id}`);
            
            return imageUrl_;

        } catch (error) {
            logger.error(`Failed to upload screenshot to Cloudinary: ${error.message}`);
            throw error;
        }
    }

    async uploadMultipleScreenshots(imageUrls, matchId) {
        const uploadedUrls = [];
        
        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const url = await this.uploadScreenshot(imageUrls[i], matchId, i + 1);
                uploadedUrls.push(url);
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                logger.error(`Failed to upload screenshot ${i + 1}: ${error.message}`);
                // Continue with other screenshots
            }
        }
        
        return uploadedUrls;
    }

    async deleteScreenshot(publicId) {
        try {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.destroy(publicId, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
            
            logger.info(`Deleted screenshot: ${publicId}`);
            return result;
        } catch (error) {
            logger.error(`Failed to delete screenshot: ${error.message}`);
            return false;
        }
    }

    async deleteMatchScreenshots(matchId) {
        try {
            // Get all resources in the match folder
            const result = await new Promise((resolve, reject) => {
                cloudinary.api.delete_resources_by_prefix(
                    `ml-hub-bot/matches/${matchId}/`,
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
            });
            
            logger.info(`Deleted screenshots for match ${matchId}: ${JSON.stringify(result)}`);
            return result;
        } catch (error) {
            logger.error(`Failed to delete match screenshots: ${error.message}`);
            return false;
        }
    }

    async getMatchScreenshots(matchId) {
        try {
            const result = await new Promise((resolve, reject) => {
                cloudinary.api.resources({
                    type: 'upload',
                    prefix: `ml-hub-bot/matches/${matchId}/`,
                    max_results: 50
                }, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
            
            return result.resources.map(r => r.secure_url);
        } catch (error) {
            logger.error(`Failed to get match screenshots: ${error.message}`);
            return [];
        }
    }
}

module.exports = new CloudinaryStorage();
const admin = require('firebase-admin');
const axios = require('axios');
const sharp = require('sharp');
const logger = require('./logger');
const { Readable } = require('stream');

class FirebaseStorage {
    constructor() {
        this.bucket = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;
        
        try {
            this.bucket = admin.storage().bucket();
            this.isInitialized = true;
            logger.info('🔥 Firebase Storage initialized successfully');
        } catch (error) {
            logger.error(`Failed to initialize Firebase Storage: ${error.message}`);
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
                timeout: 30000
            });

            // Get image buffer
            let imageBuffer = Buffer.from(response.data);
            
            // Compress image if too large (max 1MB)
            if (imageBuffer.length > 1024 * 1024) {
                imageBuffer = await sharp(imageBuffer)
                    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                logger.info(`Image compressed: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
            }

            // Generate filename
            const timestamp = Date.now();
            const filename = `matches/${matchId}/screenshot_${screenshotIndex}_${timestamp}.jpg`;
            
            // Upload to Firebase Storage
            const file = this.bucket.file(filename);
            const stream = file.createWriteStream({
                metadata: {
                    contentType: 'image/jpeg',
                    metadata: {
                        matchId: matchId,
                        uploadedAt: new Date().toISOString(),
                        originalUrl: imageUrl
                    }
                }
            });

            return new Promise((resolve, reject) => {
                stream.on('error', (error) => {
                    logger.error(`Error uploading to Firebase: ${error.message}`);
                    reject(error);
                });

                stream.on('finish', async () => {
                    // Make the file publicly accessible
                    await file.makePublic();
                    
                    // Get the public URL
                    const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${filename}`;
                    logger.info(`Screenshot uploaded: ${publicUrl}`);
                    resolve(publicUrl);
                });

                stream.end(imageBuffer);
            });

        } catch (error) {
            logger.error(`Failed to upload screenshot: ${error.message}`);
            throw error;
        }
    }

    async uploadMultipleScreenshots(imageUrls, matchId) {
        const uploadedUrls = [];
        
        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const url = await this.uploadScreenshot(imageUrls[i], matchId, i + 1);
                uploadedUrls.push(url);
                // Add small delay between uploads to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                logger.error(`Failed to upload screenshot ${i + 1}: ${error.message}`);
                // Continue with other screenshots
            }
        }
        
        return uploadedUrls;
    }

    async deleteScreenshot(fileUrl) {
        try {
            // Extract filename from URL
            const filename = fileUrl.split('/').slice(4).join('/');
            const file = this.bucket.file(filename);
            await file.delete();
            logger.info(`Deleted screenshot: ${filename}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete screenshot: ${error.message}`);
            return false;
        }
    }

    async deleteMatchScreenshots(matchId) {
        try {
            const prefix = `matches/${matchId}/`;
            const [files] = await this.bucket.getFiles({ prefix });
            
            const deletePromises = files.map(file => file.delete());
            await Promise.all(deletePromises);
            
            logger.info(`Deleted ${files.length} screenshots for match ${matchId}`);
            return files.length;
        } catch (error) {
            logger.error(`Failed to delete match screenshots: ${error.message}`);
            return 0;
        }
    }
}

module.exports = new FirebaseStorage();
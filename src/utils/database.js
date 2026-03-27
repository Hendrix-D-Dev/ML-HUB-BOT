const admin = require('firebase-admin');
const logger = require('./logger');

class FirebaseDatabase {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    async initialize(retryCount = 0) {
        if (this.isInitialized) return;
        
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._initializeWithRetry(retryCount);
        return this.initPromise;
    }

    async _initializeWithRetry(retryCount = 0) {
        const maxRetries = 5;
        const retryDelay = 5000;

        try {
            // Check if running in production (Render)
            if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
                // Use environment variables for production
                const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
                
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        privateKey: privateKey,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    }),
                    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
                });
                logger.info('🔥 Firebase initialized with environment variables');
            } else {
                // Use local service account file for development
                try {
                    const serviceAccount = require('../../serviceAccountKey.json');
                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount),
                        storageBucket: `${serviceAccount.project_id}.appspot.com`
                    });
                    logger.info('🔥 Firebase initialized with service account file');
                } catch (fileError) {
                    logger.error('Service account file not found. Make sure serviceAccountKey.json is in the root directory.');
                    throw fileError;
                }
            }
            
            this.db = admin.firestore();
            
            // Test connection with a simple write
            const testDoc = this.db.collection('_test').doc('connection');
            await testDoc.set({ 
                test: true, 
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                bot: 'ml-hub-bot',
                environment: process.env.NODE_ENV || 'development'
            });
            
            // Clean up test document
            await testDoc.delete();
            
            this.isInitialized = true;
            logger.info('🔥 Firebase initialized successfully');
            logger.info('📦 Firestore connection verified');
            
        } catch (error) {
            logger.error(`Firebase initialization failed (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`);
            
            if (error.message.includes('PERMISSION_DENIED') && retryCount < maxRetries) {
                logger.info(`Waiting ${retryDelay/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this._initializeWithRetry(retryCount + 1);
            }
            
            throw error;
        }
    }

    getFirestore() {
        if (!this.db) {
            throw new Error('Firebase not initialized. Call initialize() first.');
        }
        return this.db;
    }

    async createTicket(ticketData) {
        const db = this.getFirestore();
        const ticketRef = db.collection('tickets').doc(ticketData.ticketId);
        await ticketRef.set({
            ...ticketData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return ticketData;
    }

    async getTicket(ticketId) {
        const db = this.getFirestore();
        const ticketDoc = await db.collection('tickets').doc(ticketId).get();
        if (!ticketDoc.exists) return null;
        return { id: ticketDoc.id, ...ticketDoc.data() };
    }

    async getTicketByChannelId(channelId) {
        const db = this.getFirestore();
        const ticketsRef = db.collection('tickets');
        const query = await ticketsRef.where('channelId', '==', channelId).limit(1).get();
        
        if (query.empty) return null;
        const doc = query.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async updateTicket(ticketId, updateData) {
        const db = this.getFirestore();
        await db.collection('tickets').doc(ticketId).update({
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return this.getTicket(ticketId);
    }

    async getUserOpenTickets(userId) {
        const db = this.getFirestore();
        const ticketsRef = db.collection('tickets');
        const query = await ticketsRef
            .where('userId', '==', userId)
            .where('status', '==', 'open')
            .get();
        
        return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getOpenTicketsCount(userId) {
        const tickets = await this.getUserOpenTickets(userId);
        return tickets.length;
    }

    async createMatch(matchData) {
        const db = this.getFirestore();
        const matchRef = db.collection('matches').doc(matchData.matchId);
        await matchRef.set({
            ...matchData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return matchData;
    }

    async getMatch(matchId) {
        const db = this.getFirestore();
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) return null;
        return { id: matchDoc.id, ...matchDoc.data() };
    }

    async updateMatch(matchId, updateData) {
        const db = this.getFirestore();
        await db.collection('matches').doc(matchId).update({
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return this.getMatch(matchId);
    }

    async updateMatchScreenshots(matchId, screenshotUrls) {
        const db = this.getFirestore();
        await db.collection('matches').doc(matchId).update({
            screenshots: screenshotUrls,
            screenshotStorageType: 'firebase',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return this.getMatch(matchId);
    }

    async getPendingMatches() {
        const db = this.getFirestore();
        const matchesRef = db.collection('matches');
        const query = await matchesRef.where('status', '==', 'pending').get();
        return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getStats() {
        const db = this.getFirestore();
        
        const ticketsSnapshot = await db.collection('tickets').get();
        const openTicketsSnapshot = await db.collection('tickets').where('status', '==', 'open').get();
        const closedTicketsSnapshot = await db.collection('tickets').where('status', '==', 'closed').get();
        
        const matchesSnapshot = await db.collection('matches').get();
        const pendingMatchesSnapshot = await db.collection('matches').where('status', '==', 'pending').get();
        const verifiedMatchesSnapshot = await db.collection('matches').where('status', '==', 'verified').get();
        
        return {
            tickets: {
                total: ticketsSnapshot.size,
                open: openTicketsSnapshot.size,
                closed: closedTicketsSnapshot.size
            },
            matches: {
                total: matchesSnapshot.size,
                pending: pendingMatchesSnapshot.size,
                verified: verifiedMatchesSnapshot.size
            }
        };
    }

    async cleanupOldData(daysOld) {
        const db = this.getFirestore();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        let ticketCount = 0;
        let matchCount = 0;
        
        try {
            // Clean up old closed tickets
            const oldTickets = await db.collection('tickets')
                .where('status', '==', 'closed')
                .where('closedAt', '<', cutoffDate.toISOString())
                .get();
            
            const ticketBatch = db.batch();
            oldTickets.forEach(doc => {
                ticketBatch.delete(doc.ref);
                ticketCount++;
            });
            
            if (ticketCount > 0) {
                await ticketBatch.commit();
            }
        } catch (error) {
            logger.error(`Error cleaning tickets: ${error.message}`);
        }
        
        try {
            // Clean up old rejected matches
            const oldMatches = await db.collection('matches')
                .where('status', '==', 'rejected')
                .where('matchDate', '<', cutoffDate.toISOString())
                .get();
            
            const matchBatch = db.batch();
            oldMatches.forEach(doc => {
                matchBatch.delete(doc.ref);
                matchCount++;
            });
            
            if (matchCount > 0) {
                await matchBatch.commit();
            }
        } catch (error) {
            logger.error(`Error cleaning matches: ${error.message}`);
        }
        
        return { tickets: ticketCount, matches: matchCount };
    }
}

module.exports = new FirebaseDatabase();
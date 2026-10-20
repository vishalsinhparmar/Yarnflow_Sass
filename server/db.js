import mongoose from "mongoose";
import logger from "./src/utils/logger.js";
import { getSaasConfig } from './src/saas/config.js';

const connectDB = async () => {
    try {
        // Use environment variable for database URI, fallback to local MongoDB
        const config = getSaasConfig();
        mongoose.set('bufferCommands', false);
        await mongoose.connect(config.uri, { dbName: config.dbName, serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000, autoIndex: true });
        await Promise.all(Object.values(mongoose.models).map(model => model.init()));
        
        logger.info(`✅ Database connected successfully to: ${mongoose.connection.host}`);
        console.log(`✅ Database connected successfully to: ${mongoose.connection.host}`);
        
    } catch (err) {
        logger.error('❌ Database connection error:', err.message);
        console.error('❌ Full error:', err);
        // Exit process with failure
        await mongoose.disconnect();
        throw new Error('Isolated SaaS database connection failed');
    }
};

// Handle database connection events
mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ Database disconnected');
    console.log('⚠️ Database disconnected');
});

mongoose.connection.on('reconnected', () => {
    logger.info('🔄 Database reconnected');
    console.log('🔄 Database reconnected');
});

export default connectDB;

const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://shibinhussainmk_db_user:4XZujvl0OnCKhdN5@musicbot.3sydv1a.mongodb.net/?retryWrites=true&w=majority&appName=musicBOT';

const connectDB = async () => {
    try {
        await mongoose.connect(mongoUri);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = { connectDB, getMongoURI: () => mongoUri };
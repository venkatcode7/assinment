const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = 'mongodb+srv://mathaniyappan2023:Mathan5@cluster0.i4u6lqn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = { connectDB };
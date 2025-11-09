import mongoose from 'mongoose';
async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not defined');
  }

  try {
    const options = {};
    if (process.env.MONGODB_DBNAME) {
      options.dbName = process.env.MONGODB_DBNAME;
    }

    // Connect (mongoose will use the DB name from the URI path if present, otherwise options.dbName)
    await mongoose.connect(uri, options);
    console.log('MongoDB connected to database:', mongoose.connection.name);
  } catch (err) {
    console.error('MongoDB connection error:', err.message || err);
    throw err;
  }
}

export { connectDB, mongoose };

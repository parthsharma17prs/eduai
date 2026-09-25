import mongoose from 'mongoose';

let isConnected=false;

export async function connectMongoDB()
{
  if (isConnected) return;

  const uri=process.env.MONGODB_URI||'mongodb://localhost:27017/hirespec';

  try
  {
    await mongoose.connect(uri, {
      dbName: 'hirespec',
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });

    isConnected=true;
    console.log('✅ MongoDB connected successfully');
  } catch (error)
  {
    console.warn(`⚠️  Primary MongoDB connection failed (${error.message}). Attempting fallback to local MongoDB...`);
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/hirespec', {
        dbName: 'hirespec',
        serverSelectionTimeoutMS: 5000,
      });
      isConnected=true;
      console.log('✅ Connected successfully to local MongoDB fallback (mongodb://127.0.0.1:27017/hirespec)');
    } catch (fallbackErr) {
      console.error('❌ MongoDB connection failed:', error.message);
      console.warn('   Make sure MongoDB is running and MONGODB_URI is correct');
      throw error;
    }
  }

  mongoose.connection.on('error', (err) =>
  {
    console.error('❌ MongoDB connection error:', err.message);
    isConnected=false;
  });

  mongoose.connection.on('disconnected', () =>
  {
    console.warn('⚠️  MongoDB disconnected — will attempt to reconnect');
    isConnected=false;
  });

  mongoose.connection.on('reconnected', () =>
  {
    console.log('✅ MongoDB reconnected');
    isConnected=true;
  });
}

export function getMongoose()
{
  return mongoose;
}

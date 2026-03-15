const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  console.log(`[DB] Attempting connection to: ${uri?.replace(/\/\/.*@/, '//***:***@')}`);

  // DNS diagnostic — check if SRV record resolves
  try {
    const host = uri?.match(/@([^/?]+)/)?.[1];
    if (host) {
      const addresses = await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
      console.log(`[DB] DNS SRV resolved: ${addresses.map(a => a.name).join(', ')}`);
    }
  } catch (dnsErr) {
    console.error(`[DB] DNS resolution failed:`, dnsErr.message);
  }

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[DB] Connection attempt ${attempt}/${MAX_RETRIES}...`);
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
      };

      const conn = await mongoose.connect(uri, options);
      console.log(`[DB] MongoDB Connected: ${conn.connection.host}`);

      mongoose.connection.on('error', (err) => {
        console.error('[DB] MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('[DB] MongoDB disconnected. Attempting to reconnect...');
      });

      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('[DB] MongoDB connection closed through app termination');
        process.exit(0);
      });

      return; // success — exit the function
    } catch (error) {
      console.error(`[DB] Attempt ${attempt} failed: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 5000;
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('[DB] All connection attempts failed. Server will continue but database operations will fail.');
      }
    }
  }
};

module.exports = connectDB;

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
// Set strictQuery option based on the new Mongoose behavior
mongoose.set("strictQuery", false); // or true, depending on your preference

const connectDB = async () => {
  try {
    if (!process.env.DB_LOCAL) {
      throw new Error("DB_LOCAL environment variable is not set.");
    }
    await mongoose.connect(process.env.DB_LOCAL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("DB is connected successfully.");
  } catch (err) {
    console.error(`Error connecting to the database: ${err.message}`);
    process.exit(1); // Exit the process with failure
  }
};

export default connectDB;

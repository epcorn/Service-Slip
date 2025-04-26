import express from "express";
import path from "path";
import mongoose from "mongoose";
import morgan from "morgan";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fileUpload from "express-fileupload";
import cookieParser from "cookie-parser";
import Challan from "./models/challanModel.js"; // Adjust path if necessary
import challanRoute from "./routes/challanRoute.js";
import adminRoute from "./routes/adminRoute.js";
import userRoute from "./routes/userRoute.js";
import reportRoute from "./routes/reportRoute.js";
import {
  authenticateUser,
  authorizeUser,
} from "./middleware/authMiddleware.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(fileUpload({ useTempFiles: true }));
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

app.use("/api/user", userRoute);
app.use("/api/challan", authenticateUser, challanRoute);
app.use("/api/admin", authenticateUser, authorizeUser("Admin"), adminRoute);
app.use("/api/report", reportRoute);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, "/client/dist")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "client", "dist", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running....");
  });
}

const port = process.env.PORT || 5000;

// Replace the previous findInconsistentAmounts function with this one

// Replace the findInconsistentAmounts function again with this version including the name

const findInconsistentAmounts = async () => {
  console.log(
    "\n--- Running Refined Inconsistent Amount Check (with Name) ---"
  ); // Updated title
  try {
    const startDate = new Date("2025-03-01T00:00:00.000Z");
    const endDate = new Date("2025-03-31T23:59:59.999Z");

    console.log(
      `Querying for Challans created between ${startDate.toISOString()} and ${endDate.toISOString()} where amount.received > amount.total (and both are numbers)...`
    ); // Updated description

    // Refined criteria: Check types and then compare
    const queryCriteria = {
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
      $expr: {
        $and: [
          // Ensure both fields exist and are numeric types
          { $isNumber: "$amount.total" },
          { $isNumber: "$amount.received" },
          // Then perform the comparison only if both are numbers
          { $gt: ["$amount.received", "$amount.total"] },
        ],
      },
    };

    // 1. Get the total count first using the refined criteria
    const totalCount = await Challan.countDocuments(queryCriteria);

    console.log(
      `Result: Found ${totalCount} challan(s) for March 2025 where received > total (both numeric).`
    );

    // 2. If any found, fetch and display only the first few
    if (totalCount > 0) {
      const displayLimit = 10;
      console.log(
        `Displaying details for the first ${Math.min(
          totalCount,
          displayLimit
        )} found:`
      );

      const inconsistentChallans = await Challan.find(queryCriteria)
        .limit(displayLimit)
        // ***** MODIFIED .select() to include shipToDetails.name *****
        .select("number createdAt amount shipToDetails.name -_id")
        .lean();

      // ***** MODIFIED console.log() to include name *****
      inconsistentChallans.forEach((challan, index) => {
        // Use optional chaining for safe access to name
        const name = challan.shipToDetails?.name || "N/A";
        console.log(
          `  [${index + 1}] Number: ${
            challan.number
          }, Name: ${name}, Created: ${challan.createdAt.toISOString()}, Amount: ${JSON.stringify(
            challan.amount
          )}`
        );
      });

      if (totalCount > displayLimit) {
        console.log(
          `  ... (${totalCount - displayLimit} more records not shown)`
        );
      }
    }
  } catch (error) {
    console.error("Error during refined inconsistent amount check:", error);
  } finally {
    console.log("--- Refined Inconsistent Amount Check Complete ---\n");
  }
};

// Reminder: Make sure Challan model is imported at the top
// import Challan from "./models/challanModel.js";
// import Challan from "./models/challanModel.js";
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await findInconsistentAmounts();
    app.listen(port, () => console.log("server is listing"));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
connectDB();

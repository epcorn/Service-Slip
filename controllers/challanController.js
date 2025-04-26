import Challan from "../models/challanModel.js";
import Admin from "../models/adminModel.js"; // Keep this if other functions use it
import moment from "moment"; // Ensure moment is imported
import { createReport as createDocxReport } from "docx-templates"; // Aliased to avoid name clash if needed later
import fs from "fs";
import QRCode from "qrcode";
import { sendEmail, uploadFile } from "../utils/helperFunctions.js"; // Assuming path is correct

// Original createChallan function (Unchanged)
export const createChallan = async (req, res) => {
  let id; // Define id here so it's accessible in catch block
  try {
    // IMPORTANT: Consider fetching admin based on criteria or config, not hardcoded ID
    const admin = await Admin.findById("653f4b3413f805ca909ff232");
    if (!admin) {
      return res.status(404).json({ msg: "Admin configuration not found." });
    }

    req.body.number = `SSS - #${admin.challanCounter}#`;
    req.body.update = [
      { status: "Open", user: req.user.name, date: new Date() },
    ];
    if (
      req.body.paymentType.label === "NTB" ||
      req.body.paymentType.label === "In Guarantee"
    ) {
      req.body.verify = {
        status: true,
        invoice: true,
      };
    }
    req.body.user = req.user._id;

    const challan = await Challan.create(req.body);

    id = challan._id; // Assign id after challan creation
    const qrLink = `https://sss.sat9.in/clientAd/${id}`; // Consider making base URL configurable
    const qrCode = await QRCode.toDataURL(qrLink);

    // Ensure the template path is correct relative to your server's execution path
    const templatePath = "./tmp/template.docx";
    if (!fs.existsSync(templatePath)) {
      await Challan.findByIdAndDelete(id); // Rollback challan creation
      console.error("DOCX template not found at:", templatePath);
      return res
        .status(500)
        .json({ msg: "Server error: Template file missing." });
    }
    const template = fs.readFileSync(templatePath);

    const additionalJsContext = {
      number: challan.number,
      date: moment().format("DD/MM/YYYY"),
      serviceDate: moment(challan.serviceDate).format("DD/MM/YYYY"),
      serviceTime: challan.serviceTime.label,
      business: challan.business.label,
      area: challan.area,
      workLocation: challan.workLocation,
      sales: challan.sales.label,
      userName: req.user.name,
      amount:
        challan.paymentType.label === "Cash To Collect" ||
        challan.paymentType.label === "UPI Payment"
          ? `Amount: Rs. ${challan.amount.total} /-`
          : challan.paymentType.label === "Bill After Job"
          ? `Client GST: ${challan.gst || "N/A"}` // Handle missing GST
          : " ",
      paymentType: challan.paymentType.label,
      name: `${challan.shipToDetails.prefix.value}. ${challan.shipToDetails.name}`,
      shipToDetails: challan.shipToDetails,
      services: challan.serviceDetails,
      contactName: challan.contactName || challan.shipToDetails.contactName, // Fallback if top-level missing
      contactNo: challan.contactNo || challan.shipToDetails.contactNo,
      contactEmail: challan.contactEmail || challan.shipToDetails.contactEmail,
      url: "12", // Placeholder? Seems unused by template context below
      qrCode: async (url12) => {
        // url12 seems unused
        const data = await qrCode.slice("data:image/png;base64,".length);
        // Dimensions might need adjustment based on template placeholder size
        return { width: 2.5, height: 2.5, data, extension: ".png" };
      },
    };

    const buffer = await createDocxReport({
      // Use aliased import if needed
      cmdDelimiter: ["{", "}"],
      template,
      additionalJsContext,
    });

    // Ensure tmp directory exists
    const tmpDir = "./tmp";
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const filePath = `${tmpDir}/${challan.number}.docx`;

    fs.writeFileSync(filePath, buffer);
    const link = await uploadFile({ filePath, folder: "challan" }); // uploadFile already deletes local file on success
    if (!link) {
      await Challan.findByIdAndDelete(id); // Rollback challan creation
      // Don't delete filePath here as uploadFile might have failed before deleting it
      return res.status(400).json({ msg: "Upload error, try again later" });
    }

    admin.challanCounter += 1;
    await admin.save();
    challan.file = link;
    await challan.save();

    return res
      .status(201)
      .json({ msg: "Single service slip created", link, name: challan.number });
  } catch (error) {
    // Attempt rollback if challan was created but something else failed
    if (id) {
      try {
        await Challan.findByIdAndDelete(id);
        console.log(`Rolled back creation of challan ${id} due to error.`);
      } catch (rollbackError) {
        console.error(`Failed to rollback challan ${id}:`, rollbackError);
      }
    }
    console.error("Create Challan Error:", error); // Log the actual error
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original getChallan function (Unchanged)
export const getChallan = async (req, res) => {
  const { id } = req.params;
  try {
    const challan = await Challan.findById(id);
    if (!challan) return res.status(404).json({ msg: "Challan not found" });

    return res.json(challan);
  } catch (error) {
    console.error("Get Challan Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original updateChallan function (Unchanged)
export const updateChallan = async (req, res) => {
  const { id } = req.params;
  try {
    const challan = await Challan.findById(id);
    if (!challan) return res.status(404).json({ msg: "Challan not found" });

    const imageLinks = [];
    // Check if req.files exists and req.files.images exists before processing
    if (req.files && req.files.images) {
      let images = [];
      // Ensure images is always an array, even if only one file is uploaded
      if (Array.isArray(req.files.images)) {
        images = req.files.images;
      } else {
        images.push(req.files.images);
      }

      for (let i = 0; i < images.length; i++) {
        const filePath = images[i].tempFilePath;
        // Validate filePath exists before uploading
        if (!fs.existsSync(filePath)) {
          console.warn(`Temporary file path not found: ${filePath}`);
          continue; // Skip this file
        }
        const link = await uploadFile({ filePath, folder: "challan" });
        if (!link)
          return res
            .status(400)
            .json({ msg: "Upload error, please try again later" });

        imageLinks.push(link);
      }
    }

    let type = "Regular";
    // Check if update array exists and has elements
    if (challan.update && challan.update.length > 0) {
      if (challan.update[challan.update.length - 1].status === "Completed") {
        type = "Complaint";
      }
    }

    // Prepare the update object, only including images if some were uploaded
    const updateData = {
      ...req.body, // Spread other fields from body (status, comment, jobDate etc.)
      ...(imageLinks.length > 0 && { images: imageLinks }), // Conditionally add images
      user: req.user.name,
      date: new Date(),
      type: type,
    };
    // Remove potentially sensitive or large fields from req.body if needed before pushing
    // delete updateData.someLargeField;

    challan.update.push(updateData);

    if (req.body.amount) {
      challan.amount.received += Number(req.body.amount);
      let balance = challan.amount.total - challan.amount.received; // Calculate balance instead of modifying total
      // Reset extra/forfeited before recalculating based on current received amount? Depends on logic.
      // challan.amount.extra = 0;
      // challan.amount.forfeited = 0;
      if (balance < 0) {
        challan.amount.extra = balance * -1; // If received > total
      }
      // Note: Forfeited logic seems to be primarily in verifyAmount/makeInvoice
    }
    await challan.save();

    return res.json({ msg: "Challan updated successfully" });
  } catch (error) {
    console.error("Update Challan Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original getAllChallan function (Unchanged)
export const getAllChallan = async (req, res) => {
  const { search, page, status } = req.query;
  // Basic sanitization/validation for page
  let pageNumber = parseInt(page) || 1;
  if (pageNumber < 1) pageNumber = 1;
  const limit = 10; // Define limit constant
  const skip = limit * (pageNumber - 1);

  // Build the initial match stage for search
  let initialMatch = {};
  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    initialMatch = {
      $or: [
        { number: searchRegex },
        { "shipToDetails.name": searchRegex },
        // Add other fields to search if needed
        // { "shipToDetails.contactNo": searchRegex },
      ],
    };
  }

  // Build the pipeline stages
  let pipeline = [{ $match: initialMatch }];

  // Add status filtering stage if needed
  if (status && status !== "All") {
    pipeline.push(
      { $match: { "update.0": { $exists: true } } }, // Ensure update array exists
      { $addFields: { lastStatus: { $arrayElemAt: ["$update", -1] } } },
      { $match: { "lastStatus.status": status } }
    );
  }

  // Add sorting stage (must be before skip/limit for correct pagination)
  pipeline.push({ $sort: { createdAt: -1 } }); // Sort by creation date descending

  try {
    // Pipeline for counting total matching documents
    const countPipeline = [...pipeline, { $count: "totalCount" }];

    // Pipeline for fetching paginated documents
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    // Execute both pipelines (could run in parallel if needed, but sequential is simpler)
    const countResult = await Challan.aggregate(countPipeline);
    const challans = await Challan.aggregate(dataPipeline);

    const count = countResult[0]?.totalCount || 0;
    const pages = Math.ceil(count / limit);

    return res.json({ challans, pages: pages }); // Return calculated pages
  } catch (error) {
    console.error("Get All Challan Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original unverifiedChallans function (Unchanged, consider efficiency)
export const unverifiedChallans = async (req, res) => {
  const { search, status } = req.query;

  // Base query for unverified status
  let query = { "verify.status": false };

  // Add search criteria if provided
  if (search) {
    const searchRegex = { $regex: search, $options: "i" };
    query = {
      ...query, // Keep verify.status: false
      $or: [{ number: searchRegex }, { "shipToDetails.name": searchRegex }],
    };
  }

  try {
    // Fetch from DB based on query, sorted by serviceDate
    let challans = await Challan.find(query).sort("serviceDate");

    // Filter by status in JS if needed (Inefficient for large datasets)
    // Consider moving status filter into the DB query if possible for better performance
    if (status && status !== "All") {
      challans = challans.filter(
        (challan) =>
          challan.update && // Check if update array exists
          challan.update.length > 0 && // Check if update array has elements
          challan.update[challan.update.length - 1]?.status === status
      );
    }

    return res.json(challans);
  } catch (error) {
    console.error("Unverified Challans Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original verifyAmount function (Unchanged)
export const verifyAmount = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan) return res.status(404).json({ msg: "Challan not found" });

    // Ensure verificationNotes exists
    if (!challan.verificationNotes) {
      challan.verificationNotes = [];
    }

    challan.verify = {
      status: true,
      invoice: false, // Mark as verified, but not invoiced yet
    };

    let note = req.body.note; // Assume note comes from body for general verification
    let forfeitedAmount = 0;
    let extraAmount = 0; // Use separate variable for clarity

    if (challan.paymentType.label === "Bill After Job") {
      const billAmount = Number(req.body.billAmount) || 0; // Get bill amount safely
      challan.amount.total = billAmount; // Update total to actual bill amount
      challan.amount.received = billAmount; // Assume received = total for Bill After Job verification? Or should received be updated separately?

      if (req.body.billCompany === "NTB") {
        challan.paymentType = { label: "NTB", value: "NTB" };
        // Forfeited amount for NTB? Typically this means 'Not To Bill'.
        // If total is set to billAmount (which could be 0), forfeited might be 0 too? Clarify logic.
        forfeitedAmount = 0; // Example: Assume NTB means no amount is expected/forfeited
      } else if (req.body.billCompany === "Cash") {
        challan.paymentType = {
          label: "Cash To Collect",
          value: "Cash To Collect",
        };
        // If changing to cash, received might need adjusting based on actual payment
      } else if (req.body.billCompany === "Contract") {
        challan.paymentType = { label: "Contract", value: "Contract" };
        // Contract might imply $0 or specific handling
      }
      // Always update bill details if provided
      challan.billNo = req.body.note; // Use note as bill number?
      challan.billCompany = req.body.billCompany;
      note = `${req.body.billCompany || "N/A"} / ${req.body.note || "N/A"}`; // Construct note
    } else if (
      challan.paymentType.label === "Cash To Collect" ||
      challan.paymentType.label === "UPI Payment"
    ) {
      const cashReceivedUpdate = Number(req.body.billAmount) || 0; // Amount confirmed/received now
      const previousReceived = challan.amount.received || 0;
      const totalExpected = challan.amount.total || 0;

      challan.amount.received = previousReceived + cashReceivedUpdate; // Accumulate received amount

      const balance = totalExpected - challan.amount.received;

      if (balance < 0) {
        extraAmount = balance * -1;
        forfeitedAmount = 0;
      } else {
        forfeitedAmount = balance; // Amount remaining is forfeited
        extraAmount = 0;
      }
    }

    // Update forfeited/extra amounts
    challan.amount.forfeited = forfeitedAmount;
    challan.amount.extra = extraAmount;

    challan.verificationNotes.push({
      note: note || "Verified", // Default note if none provided
      user: req.user.name,
      date: new Date(),
    });

    await challan.save();

    return res.json({ msg: "Service slip verification done" });
  } catch (error) {
    console.error("Verify Amount Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// ============================================================
// === NEW chartData function (Replaces the old one) ===
// ============================================================
export const chartData = async (req, res) => {
  try {
    const { year, month, startDate, endDate } = req.query;

    // --- 1. Build the $match stage for date filtering ---
    const matchStage = {};
    let filtersApplied = false;

    // Use Date Range if valid start and end dates are provided
    // Validate using moment's strict parsing with a known format (e.g., ISO 8601 YYYY-MM-DD)
    if (
      startDate &&
      endDate &&
      moment(startDate, moment.ISO_8601, true).isValid() &&
      moment(endDate, moment.ISO_8601, true).isValid()
    ) {
      matchStage.createdAt = {
        // Filtering based on challan creation date
        $gte: moment(startDate).startOf("day").toDate(),
        $lte: moment(endDate).endOf("day").toDate(),
      };
      filtersApplied = true;
      console.log("Filtering by date range:", matchStage.createdAt); // Optional logging
    } else {
      // Otherwise, use Year/Month if provided
      const targetYear = year ? parseInt(year) : null;
      // Ensure month is parsed correctly (assuming 1-12)
      const targetMonth = month ? parseInt(month) : null;

      if (targetYear && !isNaN(targetYear)) {
        let yearStartDate;
        let yearEndDate;

        if (
          targetMonth &&
          !isNaN(targetMonth) &&
          targetMonth >= 1 &&
          targetMonth <= 12
        ) {
          // Specific month within the year
          yearStartDate = moment({ year: targetYear, month: targetMonth - 1 })
            .startOf("month")
            .toDate();
          yearEndDate = moment({ year: targetYear, month: targetMonth - 1 })
            .endOf("month")
            .toDate();
          console.log("Filtering by year/month:", targetYear, targetMonth); // Optional logging
        } else {
          // Entire year
          yearStartDate = moment({ year: targetYear }).startOf("year").toDate();
          yearEndDate = moment({ year: targetYear }).endOf("year").toDate();
          console.log("Filtering by year:", targetYear); // Optional logging
        }
        matchStage.createdAt = {
          $gte: yearStartDate,
          $lte: yearEndDate,
        };
        filtersApplied = true;
      }
      // If no valid filters are provided, matchStage remains empty {}, matching all documents
      if (!filtersApplied) {
        console.log("No valid date filters applied, fetching all data."); // Optional logging
      }
    }

    // --- 2. Define Aggregation Pipeline using $facet ---
    const aggregationPipeline = [
      { $match: matchStage }, // Apply date filtering first
      {
        $facet: {
          // Pipeline for Slip Counts by Status
          slipCounts: [
            // Ensure update array exists and is not empty before accessing last element
            { $match: { "update.0": { $exists: true } } },
            {
              $addFields: { lastStatusObj: { $arrayElemAt: ["$update", -1] } },
            },
            // Ensure lastStatusObj exists before grouping (handles cases where update might be empty after $match)
            { $match: { lastStatusObj: { $exists: true, $ne: null } } },
            { $group: { _id: "$lastStatusObj.status", count: { $sum: 1 } } },
            // Group again to get total filtered count and reshape status counts
            {
              $group: {
                _id: null, // Group all status counts together
                totalFilteredCount: { $sum: "$count" },
                statusCounts: { $push: { k: "$_id", v: "$count" } }, // Create key-value pairs
              },
            },
            {
              // Project the final shape for slipCounts
              $project: {
                _id: 0,
                totalCount: "$totalFilteredCount",
                // Convert the key-value array into an object { statusName: count }
                statusMap: { $arrayToObject: "$statusCounts" },
              },
            },
          ],

          // Pipeline for Cash-based Amounts
          cashAmounts: [
            {
              $match: {
                // Ensure paymentType exists and label exists before matching
                "paymentType.label": {
                  $in: ["Cash To Collect", "UPI Payment", "Invoiced"],
                },
              },
            },
            {
              // Calculate sums for cash types
              $group: {
                _id: null, // Group all cash documents together
                total: { $sum: "$amount.total" },
                received: { $sum: "$amount.received" },
                forfeited: { $sum: "$amount.forfeited" },
                extra: { $sum: "$amount.extra" },
                cancelled: { $sum: "$amount.cancelled" },
              },
            },
            { $project: { _id: 0 } }, // Remove the unnecessary _id field
          ],

          // Pipeline for Bill After Job Amounts
          billAmounts: [
            {
              $match: {
                // Ensure paymentType exists and label exists before matching
                "paymentType.label": "Bill After Job",
              },
            },
            {
              // Calculate sums for bill types
              $group: {
                _id: null, // Group all bill documents together
                total: { $sum: "$amount.total" },
                received: { $sum: "$amount.received" },
                forfeited: { $sum: "$amount.forfeited" },
                extra: { $sum: "$amount.extra" },
                cancelled: { $sum: "$amount.cancelled" },
              },
            },
            { $project: { _id: 0 } }, // Remove the unnecessary _id field
          ],
        },
      },
    ];

    // --- 3. Execute Aggregation ---
    const results = await Challan.aggregate(aggregationPipeline);

    // --- 4. Process Results, Ensuring Defaults for Missing Categories ---
    // Safely access faceted results, providing defaults if a facet returned empty
    const slipResult = results[0]?.slipCounts[0] || {
      totalCount: 0,
      statusMap: {},
    };
    const cashResult = results[0]?.cashAmounts[0] || {
      total: 0,
      received: 0,
      forfeited: 0,
      extra: 0,
      cancelled: 0,
    };
    const billResult = results[0]?.billAmounts[0] || {
      total: 0,
      received: 0,
      forfeited: 0,
      extra: 0,
      cancelled: 0,
    };

    const { statusMap = {}, totalCount = 0 } = slipResult;

    // Define the exact set of statuses expected on the dashboard chart
    const expectedStatuses = [
      "Open",
      "Completed",
      "Partially Completed",
      "Not Completed",
      "Postponed",
      "Cancelled",
      // Add any other statuses that might appear in challan.update[...].status
    ];

    // Ensure all expected status labels exist in the output, default to 0
    const slipData = [
      { label: "Total", value: totalCount },
      ...expectedStatuses.map((status) => ({
        label: status,
        value: statusMap[status] || 0,
      })),
    ];

    // Calculate pending amounts correctly, accounting for all factors
    const cashPending =
      cashResult.total -
      cashResult.received -
      cashResult.forfeited +
      cashResult.extra -
      cashResult.cancelled;
    const cashData = [
      { label: "Total", value: cashResult.total || 0 }, // Ensure default 0 if result is missing
      { label: "Received", value: cashResult.received || 0 },
      { label: "Pending", value: cashPending > 0 ? cashPending : 0 }, // Show 0 if pending is negative
      { label: "Forfeited", value: cashResult.forfeited || 0 },
      { label: "Extra", value: cashResult.extra || 0 },
      { label: "Cancelled", value: cashResult.cancelled || 0 },
    ];

    const billPending =
      billResult.total -
      billResult.received -
      billResult.forfeited +
      billResult.extra -
      billResult.cancelled;
    const billData = [
      { label: "Total", value: billResult.total || 0 },
      { label: "Received", value: billResult.received || 0 },
      { label: "Pending", value: billPending > 0 ? billPending : 0 }, // Show 0 if pending is negative
      { label: "Forfeited", value: billResult.forfeited || 0 },
      { label: "Extra", value: billResult.extra || 0 },
      { label: "Cancelled", value: billResult.cancelled || 0 },
    ];

    // --- 5. Return Formatted Data ---
    return res.json({ slipData, cashData, billData });
  } catch (error) {
    console.error("Chart Data Controller Error:", error); // Log the actual error
    res
      .status(500)
      .json({ msg: "Server error fetching chart data, try again later" });
  }
};
// ============================================================
// === END NEW chartData function ===
// ============================================================

// Original makeInvoice function (Unchanged)
export const makeInvoice = async (req, res) => {
  const { gst, billAmount } = req.body;
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan) return res.status(404).json({ msg: "Challan not found" });

    // Ensure verificationNotes exists
    if (!challan.verificationNotes) {
      challan.verificationNotes = [];
    }

    challan.verify = {
      status: true,
      invoice: true, // Mark as invoiced
    };

    challan.verificationNotes.push({
      note: "Invoice Details Sent",
      user: req.user.name,
      date: new Date(),
    });

    // Update payment type based on whether advance was received
    if (challan.amount.received > 0) {
      challan.paymentType = {
        label: "Invoiced", // e.g., If partial payment received before invoice
        value: "Invoiced",
      };
    } else {
      challan.paymentType = {
        label: "Bill After Job", // Still bill after job if no advance received
        value: "Bill After Job",
      };
    }

    const attachment = [];

    // Safely access nested properties
    const shipToDetails = challan.shipToDetails || {};
    const prefix = shipToDetails.prefix?.value || "";
    const name = shipToDetails.name || "";
    const address = shipToDetails.address || "";
    const road = shipToDetails.road || "";
    const location = shipToDetails.location || "";
    const landmark = shipToDetails.landmark || "";
    const city = shipToDetails.city || "";
    const pincode = shipToDetails.pincode || "";
    const contactName = shipToDetails.contactName || "";
    const contactNo = shipToDetails.contactNo || "";
    const contactEmail = shipToDetails.contactEmail || "";

    const services = (challan.serviceDetails || [])
      .map((item) => item.serviceName?.label)
      .filter(Boolean) // Remove undefined labels
      .join(", ");

    // Get latest update safely
    const lastUpdate =
      challan.update && challan.update.length > 0
        ? challan.update[challan.update.length - 1]
        : {};

    const dynamicData = {
      number: challan.number || "N/A",
      name: `${prefix} ${name}`.trim(),
      address: `${address}, ${road}, ${location}, ${landmark}, ${city} - ${pincode}`,
      contact: `${contactName} / ${contactNo} / ${contactEmail}`,
      serviceName: services || "N/A",
      serviceStatus: lastUpdate.status || "N/A",
      serviceDate: lastUpdate.jobDate
        ? moment(lastUpdate.jobDate).format("DD/MM/YY")
        : "Contact service team", // Format date if exists
      area: challan.area || "N/A",
      workLocation: challan.workLocation || "N/A",
      amount: req.body.billAmount || 0, // Use provided billAmount
      gst: req.body.gst || "N/A",
      sales: challan.sales?.label || "N/A",
      user: req.user.name, // User sending the invoice details
    };

    // Add attachments safely
    (lastUpdate.images || []).forEach((link, index) =>
      attachment.push({ url: link, name: `attachment-${index + 1}.jpg` })
    );

    // Validate email recipient
    const recipientEmail = process.env.YAHOO_EMAIL; // Use a more descriptive Env variable name? E.g., BILLING_TEAM_EMAIL
    if (!recipientEmail) {
      console.error(
        "Billing team email not configured in environment variables."
      );
      // Don't fail the whole request, maybe just log? Or return specific error?
      // return res.status(500).json({ msg: "Email configuration error." });
    }

    const mail = await sendEmail({
      emailList: [{ email: recipientEmail }], // Send only if recipientEmail is valid?
      attachment,
      templateId: 5, // Ensure this template ID exists in Brevo
      dynamicData,
    });
    if (!mail)
      // Consider if this should block the challan update. Maybe just log email failure?
      return res
        .status(400)
        .json({ msg: "Email error sending to billing, try again later" });

    if (gst) challan.gst = req.body.gst;

    // Recalculate amounts based on the final billAmount
    const finalBillAmount = Number(billAmount) || 0;
    const originalTotal = challan.amount.total || 0; // What was the original expected total? Might need this field.

    // If logic assumes billAmount is the NEW total:
    // challan.amount.total = finalBillAmount; // Update total? Depends on business logic.
    // challan.amount.received = finalBillAmount; // Assuming invoice means amount is now 'received' or 'billed'

    // If logic assumes billAmount is adjustment/final received:
    const previouslyReceived = challan.amount.received || 0;
    // If billAmount represents the final value to be billed/received, regardless of previous total:
    challan.amount.received = finalBillAmount;
    const balance = originalTotal - finalBillAmount; // Compare to original expectation

    if (balance < 0) {
      challan.amount.extra = balance * -1;
      challan.amount.forfeited = 0;
    } else {
      challan.amount.forfeited = balance;
      challan.amount.extra = 0;
    }

    await challan.save();
    return res.json({ msg: "Invoice details sent to billing team" });
  } catch (error) {
    console.error("Make Invoice Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original getOperatorComments function (Unchanged, consider efficiency)
export const getOperatorComments = async (req, res) => {
  try {
    // Fetch only necessary fields from Admin collection
    const values = await Admin.find({
      "comment.label": { $exists: true },
    }).select("comment"); // Filter for docs with comments and select only comment field
    const comment = [];

    values.forEach(
      // Use forEach instead of map when not creating a new array directly
      (item) =>
        // No need for item.comment check due to DB filter, but check label/value
        item.comment &&
        item.comment.label &&
        item.comment.value &&
        comment.push({
          // Assuming comment is { label: '...', value: '...' } directly on Admin model?
          // If comment is an array, logic needs adjustment.
          id: item._id, // Still need _id if fetching specific fields
          label: item.comment.label,
          value: item.comment.value,
        })
    );

    // Optional: Sort comments alphabetically by label
    comment.sort((a, b) => a.label.localeCompare(b.label));

    return res.json(comment);
  } catch (error) {
    console.error("Get Operator Comments Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original cancelChallan function (Unchanged)
export const cancelChallan = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id);
    if (!challan) return res.status(404).json({ msg: "Challan not found" });

    // Ensure update array exists
    if (!challan.update) {
      challan.update = [];
    }

    challan.update.push({
      status: "Cancelled",
      comment: req.body.note || "Cancelled by Admin/User", // Use note from body or default
      user: req.user.name,
      date: new Date(),
    });

    // Preserve original total amount before zeroing out
    const originalTotal = challan.amount.total || 0;
    challan.amount.cancelled = originalTotal; // Store the amount that was cancelled
    challan.amount.total = 0; // Set current total to 0
    challan.amount.received = 0; // Set received to 0
    challan.amount.forfeited = 0; // Reset forfeited/extra
    challan.amount.extra = 0;

    challan.verify = {
      status: true, // Mark as 'verified' in the sense that it's resolved/closed
      invoice: true, // Mark as 'invoiced' in the sense that it's resolved/closed
    };

    await challan.save();
    return res.json({ msg: "Service slip has been cancelled" });
  } catch (error) {
    console.error("Cancel Challan Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Original searchClients function (Unchanged)
export const searchClients = async (req, res) => {
  const { search } = req.query;

  // Basic validation/check for search term
  if (!search || typeof search !== "string" || search.trim().length < 1) {
    // Return empty array or specific message if search is missing/too short?
    return res.json([]);
  }

  try {
    // Consider limiting the number of results? .limit(20)
    // Consider sorting results? .sort({'shipToDetails.name': 1})
    const clients = await Challan.find({
      "shipToDetails.name": { $regex: search.trim(), $options: "i" }, // Trim search term
    }).select("shipToDetails gst _id"); // Select _id as well

    // No need to push "Not Found!!" - frontend should handle empty array
    // if (clients.length < 1)
    //   clients.push({
    //     _id: 1, // Avoid using numeric IDs if _id is ObjectId
    //     shipToDetails: { name: "Not Found!!" },
    //   });

    return res.json(clients);
  } catch (error) {
    console.error("Search Clients Error:", error);
    res.status(500).json({ msg: "Server error, try again later" });
  }
};

// Add any other functions from your original file here if they exist...

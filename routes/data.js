const express = require("express");
const router = express.Router();
const fileUpload = require("express-fileupload");
const XLSX = require("xlsx");
const verifyToken = require("../middleware/verifyToken");
const Admin = require("../models/Admin");
const Trader = require("../models/Trader");

const ProjectData = require("../models/projectDataModel");
const Offer = require("../models/Offer");
const { Bid } = require("../models/Bids");

router.use(fileUpload());
router.post("/uploadProjectData", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const file = req.files.file;
  let workbook;
  try {
    workbook = XLSX.read(file.data, { type: "buffer" });
  } catch (error) {
    console.error("Error reading Excel file:", error);
    return res.status(400).json({ error: "Invalid Excel file format." });
  }

  const sheet_name_list = workbook.SheetNames;
  if (!sheet_name_list.length) {
    return res.status(400).json({ error: "Excel file has no sheets." });
  }

  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  if (!data.length) {
    return res.status(400).json({ error: "Sheet has no data." });
  }

  const processedData = data.map((datum) => {
    // Compute Project ID
    const projectID = `${datum["Standard"]}${datum["ID"]}`;

    // Return the processed object
    return {
      ProjectID: projectID,
      Standard: datum["Standard"],
      ID: datum["ID"],
      Name: datum["Name"],
      Proponent: datum["Proponent"],
      ProjectType: datum["Project Type"],
      Methodology: datum["Methodology"],
      Country_Area: datum["Country/Area"],
      SDGs: datum["SDGs"],
      AdditionalAttributes: {
        Attribute1: datum["Additional Attribute 1"] || null,
        Attribute2: datum["Additional Attribute 2"] || null,
        Attribute3: datum["Additional Attribute 3"] || null,
      },
    };
  });

  try {
    await ProjectData.insertMany(processedData);
    res
      .status(200)
      .json({ message: "Project data uploaded and processed successfully." });
  } catch (error) {
    console.error("Error processing project data:", error);
    res.status(500).json({ error: "Error processing project data." });
  }
});

router.get("/projectData/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params; // Extract the projectId from route parameters

    // Find project data by projectId
    const projectData = await ProjectData.findOne({ ProjectID: projectId });

    // If no data is found, return a 404 error
    if (!projectData) {
      return res.status(404).json({ error: "Project data not found." });
    }

    // If data is found, return it
    res.status(200).json(projectData);
  } catch (error) {
    console.error("Error fetching project data:", error);
    res.status(500).json({ error: "Error fetching project data." });
  }
});

router.post("/offers", verifyToken, async (req, res) => {
  try {
    // Extract user from the token
    const user = req.user;

    // Create the offer with the associated user's ID
    const offer = new Offer({
      ...req.body,
      createdBy: user.email,
      onModel: user.userType,
    });

    await offer.save();
    res.status(201).send(offer);
  } catch (error) {
    res.status(400).send(error);
  }
});

// GET route to retrieve all offers
router.get("/myoffers", verifyToken, async (req, res) => {
  try {
    const user = req.user;

    let offers = [];

    if (user.userType === "Admin") {
      // Fetch offers created by the admin
      const adminOffers = await Offer.find({
        createdBy: user.email,
        onModel: "Admin",
      });

      // Fetch traders associated with the admin's company
      const tradersOfCompany = await Trader.find({ admin: user.userId });
      const traderIds = tradersOfCompany.map((trader) => trader._id);

      // Fetch offers created by traders of the same company/admin
      const traderOffers = await Offer.find({
        createdBy: { $in: traderIds },
        onModel: "Trader",
      });

      offers = adminOffers.concat(traderOffers);
    } else if (user.userType === "Trader") {
      // Fetch offers created by the trader
      offers = await Offer.find({ createdBy: user.email, onModel: "Trader" });
    }

    res.status(200).send(offers);
  } catch (error) {
    console.error("Error fetching offers:", error);
    res
      .status(500)
      .send({ message: "Internal Server Error", error: error.message });
  }
});

// POST route to create a bid for an offer
router.post("/create-bid/:offerId", verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const offerId = req.params.offerId;
    const {
      traderId,
      traderemail,
      traderCompany,
      bidAmount,
      status,
      operation,
    } = req.body;
    // console.log("Received body:", req.body);

    // Fetch the offer to ensure it exists
    const offer = await Offer.findOne({ projectId: offerId });

    if (!offer) {
      return res.status(404).json({ error: "Offer not found" });
    }

    // Check if the user making the request is the one who created the offer
    if (offer.createdBy.toString() === user.userId) {
      // If the user created the offer, they are not allowed to bid on it
      return res
        .status(403)
        .json({ error: "You cannot bid on your own offer" });
    }

    // If the check passes, proceed with creating a bid
    const bid = new Bid({
      offerId,
      traderemail,
      traderId, // This should be the ID of the user making the request (i.e., the bidder)
      traderCompany, // Include the trader's company name
      bidAmount,
      status: status || "Active", // Default to "Active" if status is not provided
      operation: operation || "Evaluating", // Default to "Evaluating" if operation is not provided
    });

    const savedBid = await bid.save();
    await Offer.findOneAndUpdate(
      { projectId: offerId },
      {
        $push: {
          bids: {
            bidId: savedBid._id, // Use the _id of the saved bid
            bidStatus: status || "Active",
            bidAmount: bidAmount,
            bidCreatorEmail: traderemail,
            // Add other necessary bid properties
          },
        },
      }
    );

    // Once the bid is created, you can return a success response or any relevant data.
    return res.status(201).json({ message: "Bid created successfully" });
  } catch (error) {
    console.error("Error creating bid:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating the bid" });
  }
});
router.get("/get-bids/:offerId", verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const offerId = req.params.offerId; // This is the projectId of the offer

    // Fetch the offer to ensure it belongs to the user
    const offer = await Offer.findOne({
      projectId: offerId,
      createdBy: user.email,
    });
    // console.log("off", offer);
    if (!offer) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Fetch all bids associated with the offer from the database
    const bids = await Bid.find({ offerId: offerId });
    // console.log("bids", bids);

    // Populate trader's companyName for each bid
    const populatedBids = await Promise.all(
      bids.map(async (bid) => {
        const trader = await Trader.findById(bid.traderId);
        return {
          ...bid._doc,
          offerData: offer, // This now includes the complete offer data
        };
      })
    );

    // Return the list of populated bids in the response.
    return res.status(200).json(populatedBids);
  } catch (error) {
    console.error("Error fetching bids:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching bids" });
  }
});

router.get("/add-to-my-offers", verifyToken, async (req, res) => {
  try {
    const projectIds = req.query.projectIds.split(","); // Assuming projectIds are separated by commas
    const user = req.user;

    // Find offers with the given project IDs
    const offers = await Offer.find({ projectId: { $in: projectIds } });
    if (!offers.length) {
      return res.status(404).json({ error: "Offers not found" });
    }

    // Add offers to user's credit offers
    const updatedUser = await Trader.findByIdAndUpdate(
      user.userId,
      {
        $addToSet: {
          creditOffers: { $each: offers.map((offer) => offer._id) },
        }, // Prevents duplicates
      },
      { new: true }
    ).populate("creditOffers");

    res.status(200).json({
      message: "Offers added to your credit offers",
      creditOffers: updatedUser.creditOffers,
    });
  } catch (error) {
    console.error("Error adding offers to credit offers:", error);
    res.status(500).json({ error: "Error adding offers to credit offers" });
  }
});
router.patch(
  "/update-bid-status/:offerId/:bidId",
  verifyToken,
  async (req, res) => {
    try {
      const { offerId, bidId } = req.params;
      const { newStatus } = req.body;
      const user = req.user;

      // Fetch the offer to ensure it exists and is created by the user
      const offer = await Offer.findOne({
        projectId: offerId,
        createdBy: user.email,
      });

      if (!offer) {
        return res.status(404).json({
          error:
            "Offer not found or you're not authorized to update this offer",
        });
      }

      // Find and update the bid status
      const updatedBid = await Bid.findByIdAndUpdate(
        bidId,
        { status: newStatus },
        { new: true }
      );

      if (!updatedBid) {
        return res.status(404).json({ error: "Bid not found" });
      }

      // Update the corresponding entry in the Offer document
      await Offer.findOneAndUpdate(
        { projectId: offerId, "bids.bidId": bidId },
        { $set: { "bids.$.bidStatus": newStatus } }
      );
      // Return the updated bid in the response
      return res
        .status(200)
        .json({ message: "Bid status updated successfully", updatedBid });
    } catch (error) {
      console.error("Error updating bid status:", error);
      return res
        .status(500)
        .json({ error: "An error occurred while updating bid status" });
    }
  }
);

router.get("/trader-offers", verifyToken, async (req, res) => {
  try {
    // console.log("User from token:", req.user);
    const traderId = req.user.userId;

    // console.log("Trader ID:", traderId);

    // Find the trader without the password field and populate the creditOffers
    const traderWithOffers = await Trader.findById(traderId)
      .select("-password") // Exclude the password field
      .populate("creditOffers");

    // console.log("Trader with offers:", traderWithOffers);

    if (!traderWithOffers) {
      return res.status(404).json({ message: "Trader not found" });
    }

    res.json(traderWithOffers);
  } catch (error) {
    console.error("Error fetching trader offers:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;

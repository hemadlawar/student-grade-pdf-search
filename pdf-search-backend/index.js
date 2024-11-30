const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { Client } = require("@elastic/elasticsearch");
const bodyParser = require("body-parser");
const fs = require("fs");

const app = express();
const port = 3000;

// Elastic Search client with authentication
const esClient = new Client({
  node: "http://localhost:9200",
  auth: {
    username: "elastic", // Replace with your actual username
    password: "thrnIgbv_R=mzqidaTPX", // Replace with your actual password
  },
});

// Middleware
app.use(bodyParser.json());

// Multer setup for file uploads with validation and cleanup
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (!file.mimetype === "application/pdf") {
      return cb(new Error("Only PDF files are allowed!"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5MB
});

// Upload PDF and index it
app.post("/upload", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const fileName = req.file.originalname;

  try {
    // Extract text from PDF
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    // Index PDF in Elastic Search
    await esClient.index({
      index: "student-grades",
      document: {
        name: fileName,
        content: pdfData.text,
      },
    });

    res
      .status(200)
      .send({ message: "File uploaded and indexed successfully." });
  } catch (error) {
    console.error("Error indexing file:", error);
    res.status(500).send({ message: "Failed to index file." });
  } finally {
    // Cleanup uploaded file
    fs.unlinkSync(filePath);
  }
});

// Search endpoint
app.get("/search", async (req, res) => {
  const { query } = req.query;

  try {
    const results = await esClient.search({
      index: "student-grades",
      query: {
        match: { content: query },
      },
      highlight: {
        fields: {
          content: {},
        },
      },
    });

    res.status(200).send(results.hits.hits);
  } catch (error) {
    console.error("Error searching:", error);
    res.status(500).send({ message: "Search failed." });
  }
});

// Error handling middleware for Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).send({ message: err.message });
  } else if (err) {
    return res.status(500).send({ message: err.message });
  }
  next();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

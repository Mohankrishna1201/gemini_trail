import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GoogleAIFileManager } from "@google/generative-ai/files";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 8000;

// Create a __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
    origin: 'https://gemini-trail.vercel.app', // Replace with your frontend URL
    methods: ['GET', 'POST'], // Allow only GET and POST requests
    allowedHeaders: ['Content-Type'], // Allow only Content-Type header
}));

// Connect to MongoDB
mongoose.connect('mongodb+srv://admin:AJj6aEVKqGrMs70u@cluster0.zht4cn6.mongodb.net/test')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Failed to connect to MongoDB', err));

// Update the file schema to include filePath
const fileSchema = new mongoose.Schema({
    fileName: String,
    fileUri: String,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now },
    filePath: String,  // Add this field to store the local file path
});

const File = mongoose.model('File', fileSchema);

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize GoogleAIFileManager with your API_KEY.
const fileManager = new GoogleAIFileManager('AIzaSyA8oQ5B86CQZ6_NR_qYSjAkRLYVpcTRKKk');
const genAI = new GoogleGenerativeAI('AIzaSyA8oQ5B86CQZ6_NR_qYSjAkRLYVpcTRKKk');

// Endpoint to handle file upload
app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;

    try {
        console.log('Uploading file:', filePath);

        // Upload the file to GoogleAIFileManager
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: "text/csv",
            displayName: req.file.originalname,
        });

        console.log('File uploaded to GoogleAIFileManager:', uploadResult);

        // Save file metadata to MongoDB with the local path
        const file = new File({
            fileName: req.file.originalname,
            fileUri: uploadResult.file.uri,
            mimeType: "text/csv",
            filePath: filePath  // Save the local path
        });

        await file.save();

        console.log('File metadata saved to MongoDB:', file);

        // Respond with file metadata
        res.json({
            fileName: file.fileName,
            fileUri: file.fileUri,
            fileId: file._id
        });

        // Optionally delete the local file after upload
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Failed to delete local file: ${filePath}`, err);
            } else {
                console.log(`Local file deleted: ${filePath}`);
            }
        });
    } catch (error) {
        console.error('Error during file upload process:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Define the POST endpoint for questions
app.post('/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    try {
        // Fetch the latest uploaded file
        const latestFile = await File.findOne().sort({ uploadedAt: -1 });
        if (!latestFile) {
            return res.status(404).json({ error: 'No file found' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-pro",
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: latestFile.mimeType,
                    fileUri: latestFile.fileUri
                }
            },
            {
                text: `${question}`
            },
        ]);

        const response = await result.response;
        const text = await response.text();
        console.log(text);
        res.json({ text });
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

app.listen(PORT, () => {
    console.log(`Server Running on http://localhost:${PORT}`);
});

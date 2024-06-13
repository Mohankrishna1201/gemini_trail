import express from 'express';
import { GoogleAIFileManager } from "@google/generative-ai/files";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware to parse JSON bodies
app.use(express.json());


// Initialize GoogleAIFileManager with your API_KEY.
const fileManager = new GoogleAIFileManager('AIzaSyA8oQ5B86CQZ6_NR_qYSjAkRLYVpcTRKKk');
const genAI = new GoogleGenerativeAI('AIzaSyA8oQ5B86CQZ6_NR_qYSjAkRLYVpcTRKKk');


// Upload the file and specify a display name.
const uploadResult = await fileManager.uploadFile("./Untitled spreadsheet - Sheet1.csv", {
    mimeType: "text/csv",
    displayName: "Sample drawing",
});

// View the response.
console.log(`Uploaded file ${uploadResult.file.displayName} as: ${uploadResult.file.uri}`);

// Get a file's metadata.
const getResult = await fileManager.getFile(uploadResult.file.name);

// View the response.
console.log(`Retrieved file ${getResult.displayName} as ${getResult.uri}`);

const model = genAI.getGenerativeModel({
    // The Gemini 1.5 models are versatile and work with multimodal prompts
    model: "gemini-1.5-flash",
});

// Define the POST endpoint
app.post('/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    try {
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri
                }
            },
            {
                text: `${question}`
            },
        ]);

        const response = await result.response;
        const text = response.text();
        console.log(text);
        res.json({ text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});


app.listen(PORT, () => {
    console.log(`Server Running on http://localhost:${PORT}`);
});
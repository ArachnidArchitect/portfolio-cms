// index.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();

const app = express();
app.use(cors()); 

const upload = multer({ dest: "uploads/" });
app.use(express.json());

// GitHub clients for each repo
const imageOctokit = new Octokit({ auth: process.env.GITHUB_IMAGE_TOKEN });
const jsonOctokit = new Octokit({ auth: process.env.GITHUB_JSON_TOKEN || process.env.GITHUB_IMAGE_TOKEN });

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { originalname, path: tempPath } = req.file;
    const { title, description, repoLink, liveLink } = req.body;
    console.log(title, description, repoLink, liveLink )
    const timestamp = Date.now();
    const filename = `${timestamp}-${originalname}`;

    // Step 1: Upload image to image repo
    const imageContent = fs.readFileSync(tempPath, { encoding: "base64" });
 const folder = process.env.GITHUB_IMAGE_FOLDER?.replace(/^\/+|\/+$/g, "");
const imageUploadPath = folder ? `${folder}/${filename}` : filename;
const link1 = repoLink;
const link2 = liveLink


    await imageOctokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_IMAGE_USERNAME,
      repo: process.env.GITHUB_IMAGE_REPO,
      path: imageUploadPath,
      message: `Add image: ${filename}`,
      content: imageContent,
    });

    // Step 2: Build GitHub Pages image URL
   const imageUrl = `https://${process.env.GITHUB_IMAGE_USERNAME}.github.io/${process.env.GITHUB_IMAGE_REPO}/${folder ? `${folder}/` : ""}${filename}`;


    // Step 3: Get data.json from metadata repo
    const { data: fileData } = await jsonOctokit.repos.getContent({
      owner: process.env.GITHUB_JSON_USERNAME,
      repo: process.env.GITHUB_JSON_REPO,
      path: process.env.GITHUB_JSON_PATH,
    });

    const jsonContent = Buffer.from(fileData.content, "base64").toString("utf-8");
    const data = JSON.parse(jsonContent);

    // Step 4: Add project entry
    const newProject = { name: title, github: link1, vercel: link2, description, image: imageUrl };
    // console.log(newProject)
    data.Projects.unshift(newProject);

    // Step 5: Push updated JSON
    const updatedContent = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

    await jsonOctokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_JSON_USERNAME,
      repo: process.env.GITHUB_JSON_REPO,
      path: process.env.GITHUB_JSON_PATH,
      message: `Add new project: ${title}`,
      content: updatedContent,
      sha: fileData.sha,
    });

    fs.unlinkSync(tempPath); // Cleanup uploaded file
    res.status(200).json({ message: "Project uploaded successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed." });
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

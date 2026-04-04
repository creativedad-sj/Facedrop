import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());
app.use("/outputs", express.static("outputs"));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "YOUR_TOKEN_HERE";

// face-to-many styles: 3D, Emoji, Video game, Pixels, Clay, Toy
const THEME_CONFIG = {
  cyberpunk: {
    style: "Video game",
    prompt: "cyberpunk warrior, neon city, glowing lights, chrome armor, futuristic, cinematic",
  },
  mughal: {
    style: "3D",
    prompt: "royal emperor, golden throne, jeweled crown, silk robes, ornate palace, warm lighting",
  },
  anime: {
    style: "Emoji",
    prompt: "anime hero, cherry blossom, dramatic wind, glowing aura, vibrant colors",
  },
  viking: {
    style: "Video game",
    prompt: "viking warrior, snowy mountains, fur armor, battle axe, stormy sky, epic",
  },
  bollywood: {
    style: "3D",
    prompt: "bollywood star, dramatic red gold background, intense, designer suit, cinematic",
  },
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasToken: REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" });
});

app.post("/api/upload-face", upload.single("face"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const ext = path.extname(req.file.originalname) || ".jpg";
  const newPath = req.file.path + ext;
  fs.renameSync(req.file.path, newPath);
  console.log("Face uploaded:", newPath);
  res.json({ faceId: path.basename(newPath) });
});

function fileToDataUri(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return "data:" + mime + ";base64," + buffer.toString("base64");
}

async function pollPrediction(predictionId) {
  const url = "https://api.replicate.com/v1/predictions/" + predictionId;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN },
    });
    const result = await response.json();
    console.log("  Poll #" + (i + 1) + ": " + result.status);
    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(result.status + ": " + (result.error || "unknown"));
    }
  }
  throw new Error("Timed out");
}

async function downloadImage(imageUrl) {
  const imgResponse = await fetch(imageUrl);
  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
  if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");
  const outputName = "card_" + Date.now() + ".jpg";
  fs.writeFileSync(path.join("outputs", outputName), imgBuffer);
  return outputName;
}

// ============================================
// GENERATE CARD
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId } = req.body;

  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const theme = THEME_CONFIG[themeId];
  if (!theme) return res.status(400).json({ error: "Unknown theme" });

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);
  console.log("");
  console.log("=== Generating: " + themeId + " ===");

  // ---- face-to-many: exact version hash, 15M+ runs ----
  try {
    console.log("  Using: face-to-many (version hash)");
    console.log("  Style: " + theme.style + ", Prompt: " + theme.prompt.substring(0, 50));

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + REPLICATE_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
        input: {
          image: faceDataUri,
          style: theme.style,
          prompt: theme.prompt,
          negative_prompt: "nsfw, nude, blurry, low quality, deformed",
          lora_scale: 1,
          instant_id_strength: 0.8,
        },
      }),
    });

    const responseText = await response.text();

    if (response.status === 429) {
      console.log("  Rate limited. Waiting 15s...");
      await new Promise((r) => setTimeout(r, 15000));
      // Retry
      const retry = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + REPLICATE_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
          input: {
            image: faceDataUri,
            style: theme.style,
            prompt: theme.prompt,
            negative_prompt: "nsfw, nude, blurry, low quality, deformed",
            lora_scale: 1,
            instant_id_strength: 0.8,
          },
        }),
      });
      const retryText = await retry.text();
      if (!retry.ok) throw new Error("Retry HTTP " + retry.status + ": " + retryText.substring(0, 200));
      var prediction = JSON.parse(retryText);
    } else if (!response.ok) {
      throw new Error("HTTP " + response.status + ": " + responseText.substring(0, 300));
    } else {
      var prediction = JSON.parse(responseText);
    }

    if (prediction.error) throw new Error(prediction.error);

    console.log("  Prediction: " + prediction.id + " (" + prediction.status + ")");
    console.log("  Waiting for result (this takes 15-45 seconds)...");

    let result = prediction;
    if (result.status !== "succeeded") {
      result = await pollPrediction(result.id);
    }

    const output = result.output;
    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl) throw new Error("No image in output: " + JSON.stringify(output).substring(0, 100));

    const outputName = await downloadImage(imageUrl);
    console.log("  SUCCESS! Saved: " + outputName);

    return res.json({
      imageUrl: "/outputs/" + outputName,
      model: "face-to-many",
      style: theme.style,
    });

  } catch (err) {
    console.log("  face-to-many FAILED: " + err.message);
  }

  // ---- Fallback: flux-kontext-pro (official, always works but no face preservation) ----
  try {
    console.log("  Fallback: flux-kontext-pro");

    const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + REPLICATE_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: "Transform this person into " + theme.prompt,
          image: faceDataUri,
          aspect_ratio: "3:4",
        },
      }),
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    let result = await response.json();
    if (result.status !== "succeeded" && result.id) {
      result = await pollPrediction(result.id);
    }

    const imageUrl = typeof result.output === "string" ? result.output : (Array.isArray(result.output) ? result.output[0] : null);
    if (!imageUrl) throw new Error("No output");

    const outputName = await downloadImage(imageUrl);
    console.log("  Fallback SUCCESS: " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux-kontext-pro" });

  } catch (err) {
    console.log("  Fallback FAILED: " + err.message);
  }

  res.status(500).json({ error: "All models failed" });
});

// Debug
app.get("/api/debug/test-token", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN },
    });
    res.json(await r.json());
  } catch (err) {
    res.json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP Backend on port " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("  Model: fofr/face-to-many (15M+ runs)");
  console.log("============================================");
});
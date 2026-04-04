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
app.use(express.json({ limit: "50mb" }));
app.use("/outputs", express.static("outputs"));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "YOUR_TOKEN_HERE";
const PORT = process.env.PORT || 3001;

// ============================================
// PROMPTS — Key insight: tell Flux to KEEP the face
// "Keep this person's exact face, skin tone, facial hair,
//  and features unchanged" is the critical instruction
// ============================================
const THEMES = {
  cyberpunk: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged. Only change their outfit and background. Dress them in futuristic chrome and black tactical cyberpunk armor with glowing cyan LED strips on the chest and shoulders. Place them standing in a rain-soaked neon-lit Tokyo alley at night with massive holographic pink and blue advertisements glowing behind them. Rain reflects neon on wet street. Blade runner cinematic lighting, dramatic, hyper detailed 8k photograph",
    fallback_style: "Video game",
    fallback_prompt: "cyberpunk warrior, neon rain city, chrome tactical armor with cyan LEDs, holographic billboards, blade runner, cinematic",
  },
  mughal: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged. Only change their outfit and background. Dress them in a magnificent royal Mughal brocade silk sherwani with heavy gold embroidery, a jeweled turban with peacock feather and diamond ornament, and heavy gold necklaces with rubies and emeralds. Seat them on an ornate golden throne in a palace with intricate marble inlay walls, arched doorways with floral motifs, and warm golden candlelight. Oil painting masterpiece lighting, ultra detailed 8k",
    fallback_style: "3D",
    fallback_prompt: "mughal emperor, golden throne, jeweled turban, brocade silk sherwani, marble palace, candlelight, regal oil painting",
  },
  anime: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged. Only change their outfit and background. Dress them in a dramatic flowing black leather coat with red lining that billows in wind. Place them standing on a Tokyo skyscraper rooftop at sunset with cherry blossom petals swirling around them. The city stretches below with dramatic orange and purple sky. Vibrant saturated colors, cinematic anime-inspired composition, dramatic backlit, hyper detailed 8k photograph",
    fallback_style: "Emoji",
    fallback_prompt: "anime hero, skyscraper rooftop, flowing black coat red lining, cherry blossoms, sunset tokyo, dramatic",
  },
  viking: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged. Only change their outfit and background. Dress them in a heavy bear fur cloak over chainmail armor. Add subtle blue war paint in Norse patterns on their cheekbones. Place them standing on a snowy cliff overlooking a dramatic fjord with a dragon-headed Viking longship in the icy water below. Overcast sky with dramatic golden rays breaking through clouds. Epic cinematic Lord of the Rings aesthetic, hyper detailed 8k photograph",
    fallback_style: "Video game",
    fallback_prompt: "viking warrior, bear fur cloak, chainmail, blue war paint, snowy cliff, fjord, longship, epic cinematic",
  },
  bollywood: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged. Only change their outfit and background. Dress them in a perfectly tailored midnight black bandhgala suit with gold buttons, a gold pocket square, and a heavy gold chain around the neck. Give them a confident powerful expression. Place them at a grand palace party with crystal chandeliers, red velvet curtains, and dramatic warm rim lighting from behind. Bollywood movie poster cinematic style, Sanjay Leela Bhansali aesthetic, hyper detailed 8k photograph",
    fallback_style: "3D",
    fallback_prompt: "bollywood villain, black bandhgala suit gold accents, gold chain, palace party, chandeliers, cinematic rim lighting",
  },
  samurai: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged. Only change their outfit and background. Dress them in full traditional samurai yoroi armor in black lacquer and gold with red silk cord binding. Place a katana sheathed at their side. Set them in a serene Japanese temple garden during golden hour with a traditional wooden temple behind them, a koi pond with stone bridge, and cherry blossom petals drifting through warm golden light. Akira Kurosawa cinematic style, painterly, hyper detailed 8k photograph",
    fallback_style: "3D",
    fallback_prompt: "samurai master, yoroi armor black gold, katana, japanese temple garden, cherry blossoms, golden hour, kurosawa",
  },
  astronaut: {
    prompt: "Keep this exact person's face, skin tone, facial structure, and facial hair completely unchanged and clearly visible through a transparent helmet visor. Dress them in a detailed white NASA-style spacesuit with mission patches and an American flag. Place them floating in space with the blue marble of Earth visible behind them and the International Space Station in the background. Harsh sunlight from the right creating dramatic contrast. Gravity movie IMAX aesthetic, photorealistic, hyper detailed 8k photograph",
    fallback_style: "3D",
    fallback_prompt: "astronaut in space, white NASA spacesuit, earth behind, ISS background, dramatic sun, gravity movie, photorealistic",
  },
};

// ============================================
// HELPERS
// ============================================
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
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url, { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } });
    const result = await response.json();
    console.log("    Poll #" + (i + 1) + ": " + result.status);
    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") throw new Error(result.status + ": " + (result.error || "unknown"));
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

function getImageUrl(result) {
  if (typeof result.output === "string") return result.output;
  if (Array.isArray(result.output) && result.output.length > 0) return result.output[0];
  return null;
}

async function callModel(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (response.status === 429) {
    console.log("    Rate limited, waiting 15s...");
    await new Promise((r) => setTimeout(r, 15000));
    const retry = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const rt = await retry.text();
    if (!retry.ok) throw new Error("Retry " + retry.status);
    return JSON.parse(rt);
  }
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + text.substring(0, 200));
  return JSON.parse(text);
}

// ============================================
// GENERATE CARD
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId } = req.body;
  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const theme = THEMES[themeId];
  if (!theme) return res.status(400).json({ error: "Unknown theme" });

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);
  console.log("");
  console.log("========================================");
  console.log("  GENERATING: " + themeId.toUpperCase());
  console.log("========================================");

  // ---- PRIMARY: Flux Kontext Pro with face image ----
  try {
    console.log("  Flux Kontext Pro (face-preserving prompt)...");

    const prediction = await callModel(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      {
        input: {
          image: faceDataUri,
          prompt: theme.prompt,
          aspect_ratio: "3:4",
          safety_tolerance: 5,
          output_quality: 95,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    console.log("    Prediction: " + prediction.id);

    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id);

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output image");

    const outputName = await downloadImage(imageUrl);
    console.log("  SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux-kontext-pro", quality: "cinematic" });

  } catch (err) {
    console.log("  Flux FAILED: " + err.message);
  }

  // ---- FALLBACK: face-to-many ----
  try {
    console.log("  Fallback: face-to-many...");

    const prediction = await callModel(
      "https://api.replicate.com/v1/predictions",
      {
        version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
        input: {
          image: faceDataUri,
          style: theme.fallback_style,
          prompt: theme.fallback_prompt,
          negative_prompt: "nsfw, nude, blurry, low quality, deformed, ugly",
          instant_id_strength: 0.8,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id);

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output");

    const outputName = await downloadImage(imageUrl);
    console.log("  FALLBACK SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "face-to-many", quality: "stylized" });

  } catch (err) {
    console.log("  Fallback FAILED: " + err.message);
  }

  res.status(500).json({ error: "All generation failed" });
});

// Debug
app.get("/api/debug/test-token", async (req, res) => {
  try { const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } }); res.json(await r.json()); }
  catch (err) { res.json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP v4.0 — Face-Preserving Pipeline");
  console.log("  Port: " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("  Primary: Flux Kontext Pro (face-preserving)");
  console.log("  Fallback: face-to-many (stylized)");
  console.log("============================================");
});
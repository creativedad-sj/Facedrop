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
// THEME DEFINITIONS
// pulid_prompt: For Flux PuLID (no trigger words, just describe the scene)
// scene_prompt: For two-step pipeline (Flux generates scene without face)
// fallback_prompt: For face-to-many
// ============================================
const GENDER_WORDS = {
  male: { subject: "man", title: "king", honorific: "lord", adj: "handsome" },
  female: { subject: "woman", title: "queen", honorific: "lady", adj: "beautiful" },
  neutral: { subject: "person", title: "monarch", honorific: "sovereign", adj: "striking" }
};

const THEMES = {
  cyberpunk: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a cyberpunk warrior standing in a rain-soaked neon-lit Tokyo alley at night, wearing futuristic chrome and black tactical armor with glowing cyan LED strips, massive holographic pink and blue advertisements behind them, rain reflecting neon on wet street, blade runner cinematic lighting, dramatic, hyper detailed 8k photograph", scene_prompt: "a cinematic portrait of a lone cyberpunk warrior standing in a rain-soaked neon-lit Tokyo alley at night, wearing chrome tactical armor with cyan LEDs, holographic billboards, blade runner aesthetic, dramatic lighting, 8k, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "cyberpunk {{subject}}, neon rain city, chrome armor, cyan LEDs, blade runner, cinematic" },
  mughal: { pulid_prompt: "portrait of a {{adj}} Mughal {{title}} seated on an ornate golden throne in a palace, wearing magnificent brocade silk sherwani with gold embroidery, jeweled turban with peacock feather and diamond ornament, heavy gold necklaces with rubies and emeralds, intricate marble inlay walls, warm golden candlelight, oil painting masterpiece, Rembrandt lighting, ultra detailed 8k", scene_prompt: "a cinematic portrait of a Mughal emperor on an ornate golden throne in the Diwan-i-Khas palace, jeweled turban with peacock feather, brocade silk sherwani with gold embroidery, gold necklaces with rubies, marble inlay, warm candlelight, oil painting masterpiece, 8k, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "mughal {{title}}, golden throne, jeweled turban, brocade silk, marble palace, candlelight, regal" },
  anime: { pulid_prompt: "portrait of a {{adj}} {{subject}} as an anime hero standing on a Tokyo skyscraper rooftop at sunset, wearing a dramatic flowing black coat with red lining billowing in wind, cherry blossom petals swirling around them, city below with dramatic orange and purple sky, vibrant saturated colors, anime-inspired cinematic composition, detailed 8k", scene_prompt: "an anime hero standing on a Tokyo skyscraper rooftop at sunset, flowing black coat with red lining in wind, cherry blossom petals, dramatic orange purple sky, vibrant colors, anime-inspired cinematic, 8k, face clearly visible, portrait 3:4", fallback_style: "Emoji", fallback_prompt: "anime hero {{subject}}" },
  viking: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a fearsome Viking warrior chieftain standing on a snowy cliff overlooking a fjord, wearing heavy bear fur cloak over chainmail armor, blue war paint in Norse patterns on face, holding a massive battle axe, dragon-headed longship in icy water below, dramatic overcast sky with golden rays, epic Lord of the Rings aesthetic, hyper detailed 8k photograph", scene_prompt: "a Viking warrior chieftain on a snowy cliff over a fjord, bear fur cloak over chainmail, horned helmet, blue war paint, battle axe, longship below, dramatic overcast sky with light rays, epic cinematic, 8k, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "viking {{subject}}" },
  bollywood: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a powerful Bollywood villain at a grand palace party, wearing perfectly tailored midnight black bandhgala suit with gold buttons, gold pocket square, heavy gold chain, confident menacing expression, crystal chandeliers, red velvet curtains, warm dramatic rim lighting, Sanjay Leela Bhansali cinematography, movie poster aesthetic, 8k cinematic photograph", scene_prompt: "a powerful Bollywood villain at a grand palace party, black bandhgala suit with gold buttons, gold chain, confident expression, crystal chandeliers, red velvet, dramatic rim lighting, cinematic movie poster style, 8k, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "bollywood villain {{subject}}" },
  samurai: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a legendary samurai master in a serene Japanese temple garden during golden hour, wearing full traditional yoroi armor in black and gold with red silk cord binding, katana sheathed at side, wooden temple with curved roofs behind, koi pond, cherry blossom petals in warm golden light, Akira Kurosawa cinematography, painterly, 8k photograph", scene_prompt: "a legendary samurai in a Japanese temple garden at golden hour, full yoroi armor black and gold, red silk bindings, katana at side, wooden temple, koi pond, cherry blossoms, golden light, Kurosawa cinematic, 8k, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "samurai {{subject}}" },
  astronaut: { pulid_prompt: "portrait of a {{adj}} {{subject}} as an astronaut floating in space with Earth visible behind them, wearing detailed white NASA-style spacesuit with mission patches, visor reflecting blue Earth and stars, International Space Station in background, harsh sunlight creating dramatic contrast, Gravity movie IMAX aesthetic, photorealistic, hyper detailed 8k photograph", scene_prompt: "an astronaut floating in space, white NASA spacesuit with patches, Earth behind, visor reflecting blue marble and stars, ISS in background, harsh sun dramatic contrast, Gravity movie IMAX quality, 8k, face visible through clear visor, portrait 3:4", fallback_style: "3D", fallback_prompt: "astronaut {{subject}}" },
  pirate: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a pirate captain standing on a storm-tossed ship deck, wearing weathered leather tricorn hat, gold hoop earring, holding a cutlass, crashing waves and dark clouds, dramatic cinematic lighting, hyper detailed 8k photograph", scene_prompt: "a pirate captain on a storm-tossed ship deck, leather tricorn hat, gold hoop earring, crashing waves, dramatic sky, cinematic portrait, 8k, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "pirate {{subject}}" },
  greek_god: { pulid_prompt: "portrait of a {{adj}} {{subject}} as an ancient Greek deity atop Mount Olympus, wearing flowing white robes with gold accents, laurel wreath crown, glowing eyes with divine light, marble columns and stormy clouds, epic cinematic composition, hyper detailed 8k photograph", scene_prompt: "an ancient Greek deity atop Mount Olympus, golden laurel wreath, glowing eyes, marble columns, stormy sky, epic cinematic, 8k, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "greek god {{title}}" },
  steampunk: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a steampunk inventor in a brass-laden workshop, wearing leather apron with brass goggles, mechanical arm prosthesis, steam pipes and glowing gauges, Victorian industrial aesthetic, hyper detailed 8k photograph", scene_prompt: "a steampunk inventor in a brass-laden workshop, goggles, mechanical arm, steam pipes, glowing gauges, cinematic portrait, 8k, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "steampunk {{subject}}" },
  wasteland: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a wasteland survivor standing on cracked desert dunes, wearing spiked armor made from scrap metal, holding a makeshift weapon, burning horizon with ruined vehicles, dramatic Mad Max style lighting, hyper detailed 8k photograph", scene_prompt: "a wasteland survivor in spiked armor standing on cracked desert dunes, burning horizon, ruined vehicles, dramatic cinematic lighting, 8k, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "wasteland {{subject}}" },
  cyber_ninja: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a cyber-ninja in a neon-lit alley, wearing sleek black tactical suit with glowing purple visor, holographic displays, rain-slicked streets, futuristic ninja aesthetic, hyper detailed 8k photograph", scene_prompt: "a cyber-ninja in a neon-lit alley, futuristic suit, purple visor glowing, rain and holograms, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "cyber ninja {{subject}}" },
  vampire: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a gothic vampire sovereign in a candlelit cathedral, wearing flowing black cape with red silk lining, pale aristocratic features, stained glass windows casting colored light, dark romantic aesthetic, hyper detailed 8k photograph", scene_prompt: "a gothic vampire sovereign in a candlelit cathedral, red cloak, pale skin, stained glass, gothic arches, dramatic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "vampire {{subject}}" },
  knight: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a noble knight in shining silver plate armor, standing in a medieval castle hall with banners and torches, sword at side, determined expression, cinematic fantasy lighting, hyper detailed 8k photograph", scene_prompt: "a noble knight in silver armor within a medieval castle hall, banners and torches, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "knight {{subject}}" },
  forest_druid: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a mystical druid in an ancient glowing forest clearing, wearing crown of antlers and flowing robes with leaf patterns, surrounded by bioluminescent plants and mist, magical ethereal lighting, hyper detailed 8k photograph", scene_prompt: "a mystical druid in a glowing ancient forest clearing, antler crown, mist, bioluminescent plants, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "druid {{subject}}" },
  noir: { pulid_prompt: "portrait of a {{adj}} {{subject}} as a 1940s noir detective standing on a rain-slicked street at night, wearing trench coat and fedora, cigarette smoke, neon signs reflecting on wet pavement, black and white cinematic lighting, hyper detailed 8k photograph", scene_prompt: "a 1940s noir detective in trench coat and fedora on a rain-slicked street, neon signs, black and white cinematic lighting, 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "noir detective {{subject}}" },
  atlantis: { pulid_prompt: "portrait of a {{adj}} {{subject}} as an underwater ruler of Atlantis, wearing scale armor with glowing blue runes, trident in hand, coral palace in background, bioluminescent sea creatures, mystical underwater lighting, hyper detailed 8k photograph", scene_prompt: "an underwater ruler of Atlantis in scale armor with a trident, glowing coral palace, 8k cinematic portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "atlantis {{title}}" },
  egyptian: { pulid_prompt: "portrait of a {{adj}} {{subject}} as an ancient Egyptian pharaoh beside towering pyramids at sunset, wearing gold headpiece with cobra ornament, flowing linen robes, golden light casting long shadows, majestic desert landscape, hyper detailed 8k photograph", scene_prompt: "an ancient Egyptian ruler in gold headpiece beside pyramids at sunset, rich fabrics, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "pharaoh {{subject}}" },
  cyber_hacker: { pulid_prompt: "tech hacker {{subject}}, holographic screens, glowing code, 8k", scene_prompt: "a cyber hacker surrounded by holographic screens and glowing code in a dark room, neon green light, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "hacker {{subject}}" },
  ice_monarch: { pulid_prompt: "Ice {{title}} in palace of frozen glass, crown of ice, 8k", scene_prompt: "an ice monarch in a frozen glass palace, crown of ice, blue-white light, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "ice king {{title}}" },
  wild_west: { pulid_prompt: "wild west outlaw {{subject}}, leather duster, cowboy hat, 8k", scene_prompt: "a wild west outlaw in a dusty frontier town, leather duster, cowboy hat, sepia cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "cowboy {{subject}}" },
  gladiator: { pulid_prompt: "Roman gladiator {{subject}} in Colosseum, bronze chestplate, 8k", scene_prompt: "a Roman gladiator in the Colosseum with cheering crowds, bronze armor, sunlight shafts, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "gladiator {{subject}}" },
  elven: { pulid_prompt: "ethereal elven {{subject}} in silver forest, long bow, 8k", scene_prompt: "an ethereal elven ranger in a silver forest with a longbow and moonlight, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "elf {{subject}}" },
  wizard: { pulid_prompt: "powerful wizard {{subject}} in star robes, staff with glowing gem, 8k", scene_prompt: "a powerful wizard in star robes holding a glowing staff in a mystic tower, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "wizard {{subject}}" },
  cyber_medic: { pulid_prompt: "futuristic cyber-medic {{subject}}, sleek armor, healing nanobots, 8k", scene_prompt: "a futuristic cyber-medic in sleek armor with healing nanobots, hospital tech background, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "sci-fi doctor {{subject}}" },
  solarpunk: { pulid_prompt: "solarpunk architect {{subject}} in green city, vertical gardens, 8k", scene_prompt: "a solarpunk architect in a green city with vertical gardens and solar glass, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "solarpunk {{subject}}" },
  superhero: { pulid_prompt: "superhero {{subject}} in high-tech suit, hero pose, 8k cinematic", scene_prompt: "a superhero in a high-tech suit striking a heroic pose over the city, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "superhero {{subject}}" },
  monk: { pulid_prompt: "shaolin monk {{subject}} in orange robes, mountain peak, 8k", scene_prompt: "a shaolin monk in orange robes atop a mountain peak at sunrise, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "monk {{subject}}" },
  racer: { pulid_prompt: "formula 1 racer {{subject}} in futuristic suit, race car background, 8k", scene_prompt: "a formula 1 racer in a futuristic suit standing on a race track with blurred cars, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "Video game", fallback_prompt: "racer {{subject}}" },
  sorcerer: { pulid_prompt: "dark sorcerer {{subject}}, purple flames, obsidian throne, 8k", scene_prompt: "a dark sorcerer seated on an obsidian throne with purple flames swirling, cinematic 8k portrait, face clearly visible, portrait 3:4", fallback_style: "3D", fallback_prompt: "sorcerer {{subject}}" }
};
// ============================================
// HELPERS
// ============================================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasToken: REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" });
});

app.post("/api/upload-face", upload.single("face"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  if (req.file.size > 5 * 1024 * 1024) return res.status(400).json({ error: "File too large (max 5MB)" });
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

async function pollPrediction(predictionId, label) {
  const url = "https://api.replicate.com/v1/predictions/" + predictionId;
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const response = await fetch(url, { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } });
    const result = await response.json();
    console.log("    [" + label + "] Poll #" + (i + 1) + ": " + result.status);
    if (result.status === "succeeded") return result;
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(result.status + ": " + (result.error || "unknown"));
    }
  }
  throw new Error("Timed out after 3 min");
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
    console.log("    Rate limited, waiting 20s...");
    await new Promise((r) => setTimeout(r, 20000));
    const retry = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const rt = await retry.text();
    if (!retry.ok) throw new Error("Retry failed " + retry.status + ": " + rt.substring(0, 200));
    return JSON.parse(rt);
  }
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + text.substring(0, 300));
  return JSON.parse(text);
}

// ============================================
// GENERATE CARD — Three-tier face preservation
//
// TIER 1: Flux PuLID (single-step, explicit face embedding)
//   - Best face fidelity from a single selfie
//   - Uses PuLID contrastive alignment on FLUX.1
//   - start_step=0, id_weight=1.0 for max face preservation
//
// TIER 2: Two-step (Flux Kontext scene + codeplugtech face-swap)
//   - Generates cinematic scene, then swaps face onto it
//   - Highest raw face accuracy (~95%+)
//
// TIER 3: face-to-many (stylized fallback)
//   - Already proven to work
// ============================================
app.post("/api/generate-card", async (req, res) => {
  const { faceId, themeId, gender = "neutral" } = req.body; // Added gender
  if (!faceId || !themeId) return res.status(400).json({ error: "faceId and themeId required" });

  const theme = THEMES[themeId];
  if (!theme) return res.status(400).json({ error: "Unknown theme: " + themeId });

   // Placeholder logic
  const terms = GENDER_WORDS[gender];
  const processPrompt = (str) => {
    return str.replace(/{{subject}}/g, terms.subject)
              .replace(/{{title}}/g, terms.title)
              .replace(/{{honorific}}/g, terms.honorific)
              .replace(/{{adj}}/g, terms.adj);
  };

  const pulid_prompt = processPrompt(theme.pulid);
  const fallback_prompt = processPrompt(theme.fallback_prompt);

  const facePath = path.join("uploads", faceId);
  if (!fs.existsSync(facePath)) return res.status(404).json({ error: "Face not found" });

  const faceDataUri = fileToDataUri(facePath);

  console.log("");
  console.log("========================================");
  console.log("  GENERATING: " + themeId.toUpperCase());
  console.log("========================================");

  // =========================================
  // TIER 1: Flux PuLID — single-step face embedding
  // =========================================
  try {
    console.log("  [TIER 1] Flux PuLID (face embedding)...");
    console.log("    Using: bytedance/flux-pulid");
    console.log("    start_step=0, id_weight=1.0 (max face fidelity)");

    const prediction = await callModel(
      "https://api.replicate.com/v1/predictions",
      {
        version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
        input: {
          main_face_image: faceDataUri,
          prompt: pulid_prompt,
          negative_prompt: "(lowres, low quality, worst quality:1.2), watermark, deformed, mutated, cross-eyed, ugly, disfigured, bad anatomy, bad hands, text",
          width: 768,
          height: 1024,
          num_steps: 20,
          start_step: 0,
          guidance_scale: 4,
          id_weight: 1.0,
          true_cfg: 1,
          max_sequence_length: 128,
          output_format: "png",
          output_quality: 95,
          num_outputs: 1,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    console.log("    Prediction: " + prediction.id);

    let result = prediction;
    if (result.status !== "succeeded") {
      result = await pollPrediction(result.id, "PuLID");
    }

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output image");

    const outputName = await downloadImage(imageUrl);
    console.log("  TIER 1 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux-pulid", quality: "face-embedded" });

  } catch (err) {
    console.log("  TIER 1 FAILED: " + err.message);
  }

  // =========================================
  // TIER 2: Two-step — scene generation + face swap
  // =========================================
  try {
    console.log("  [TIER 2] Two-step pipeline...");

    // Step 2a: Generate cinematic scene with Flux Kontext Pro
    console.log("    Step 1: Generating scene with Flux Kontext Pro...");
    const sceneResult = await callModel(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
      {
        input: {
          prompt: theme.scene_prompt,
          aspect_ratio: "3:4",
          safety_tolerance: 5,
          output_quality: 95,
        },
      }
    );

    if (sceneResult.error) throw new Error("Scene: " + sceneResult.error);
    let scene = sceneResult;
    if (scene.status !== "succeeded") scene = await pollPrediction(scene.id, "Scene");

    const sceneUrl = getImageUrl(scene);
    if (!sceneUrl) throw new Error("No scene image");
    console.log("    Step 1 DONE — scene generated");

    // Step 2b: Swap face using codeplugtech/face-swap
    console.log("    Step 2: Swapping face with codeplugtech/face-swap...");
    const swapResult = await callModel(
      "https://api.replicate.com/v1/models/codeplugtech/face-swap/predictions",
      {
        input: {
          input_image: sceneUrl,
          swap_image: faceDataUri,
        },
      }
    );

    if (swapResult.error) throw new Error("Swap: " + swapResult.error);
    let swap = swapResult;
    if (swap.status !== "succeeded") swap = await pollPrediction(swap.id, "FaceSwap");

    const swapUrl = getImageUrl(swap);
    if (!swapUrl) throw new Error("No swap output");

    const outputName = await downloadImage(swapUrl);
    console.log("  TIER 2 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "flux+faceswap", quality: "cinematic-swap" });

  } catch (err) {
    const message = err.message || "Unknown error";
    console.log("  TIER 2 FAILED: " + message);
    if (message.includes("404")) {
      console.log("    Face-swap endpoint may be unavailable or the model path is invalid.");
    }
  }

  // =========================================
  // TIER 3: face-to-many (stylized fallback)
  // =========================================
  try {
    console.log("  [TIER 3] face-to-many (fallback)...");

    const prediction = await callModel(
      "https://api.replicate.com/v1/predictions",
      {
        version: "35cea9c3164d9fb7fbd48b51503eabdb39c9d04fdaef9a68f368bed8087ec5f9",
        input: {
          image: faceDataUri,
          style: theme.fallback_style,
          prompt: fallback_prompt,
          negative_prompt: "nsfw, nude, blurry, low quality, deformed, ugly, bad anatomy",
          instant_id_strength: 0.8,
        },
      }
    );

    if (prediction.error) throw new Error(prediction.error);
    let result = prediction;
    if (result.status !== "succeeded") result = await pollPrediction(result.id, "FaceToMany");

    const imageUrl = getImageUrl(result);
    if (!imageUrl) throw new Error("No output");

    const outputName = await downloadImage(imageUrl);
    console.log("  TIER 3 SUCCESS! " + outputName);
    return res.json({ imageUrl: "/outputs/" + outputName, model: "face-to-many", quality: "stylized" });

  } catch (err) {
    console.log("  TIER 3 FAILED: " + err.message);
  }

  console.log("  ALL TIERS FAILED");
  res.status(500).json({ error: "All generation methods failed" });
});

// Debug endpoints
app.get("/api/debug/test-token", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN } });
    res.json(await r.json());
  } catch (err) { res.json({ error: err.message }); }
});

// Test Flux PuLID specifically
app.get("/api/debug/test-pulid", async (req, res) => {
  try {
    const r = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b",
        input: {
          prompt: "portrait of a person, cinematic lighting",
          width: 512,
          height: 512,
          num_steps: 4,
          num_outputs: 1,
        },
      }),
    });
    const data = await r.json();
    res.json({ status: r.status, data: data });
  } catch (err) { res.json({ error: err.message }); }
});

// Start
app.listen(PORT, () => {
  console.log("");
  console.log("============================================");
  console.log("  FACEDROP v5.0 — Face Preservation Engine");
  console.log("  Port: " + PORT);
  console.log("  Token: " + (REPLICATE_API_TOKEN !== "YOUR_TOKEN_HERE" ? "YES" : "MISSING"));
  console.log("");
  console.log("  Three-tier pipeline:");
  console.log("    T1: Flux PuLID (face embedding, best fidelity)");
  console.log("    T2: Flux scene + codeplugtech face-swap");
  console.log("    T3: face-to-many (stylized fallback)");
  console.log("");
  console.log("  Debug: /api/debug/test-token");
  console.log("         /api/debug/test-pulid");
  console.log("============================================");
});
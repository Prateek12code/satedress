// server.js — Gemini 2.5 Flash Image fusion (person + dress)
// Node 18+ (global fetch). No ESM required.

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");

const GEMINI_KEY = process.env.GEMINI_API_KEY; // set in shell before start
const PORT = process.env.PORT || 5000;
const MODEL = "gemini-2.5-flash-image";

const app = express();
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// serve static
app.use(express.static(__dirname));
app.use("/uploads", express.static(uploadDir));
app.use("/assets", express.static(path.join(__dirname, "assets")));

const JOBS = Object.create(null);

// List built-in dresses from assets/dresses
app.get("/api/catalog", async (_req, res) => {
  try {
    const dir = path.join(__dirname, "assets", "dresses");
    const files = (await fsp.readdir(dir)).filter((n) =>
      /\.(png|jpg|jpeg|webp)$/i.test(n)
    );
    const urls = files.map((n) => `/assets/dresses/${encodeURIComponent(n)}`);
    res.json(urls);
  } catch (e) {
    res.json([]); // empty gallery if none
  }
});

// ---- Gemini call (two images + prompt) ----
async function fileToBase64(p) {
  return (await fsp.readFile(p)).toString("base64");
}

function buildPrompt(category, crop) {
  // Ultra “full-body” prompt. Tuned for close-up → full-body extension.
  return `You are a professional AI fashion editor.
Use the first image as the reference for the person — keep their face, body shape, age, hairstyle, and expression exactly the same.
Completely replace their current outfit with the garment from the second image while ensuring perfect fitting, realistic fabric texture, and natural draping.
Remove every trace of the original clothing and blend the new dress seamlessly into the body using correct lighting, shadows, and proportions.
Ensure the result looks like a real full-body studio photograph with balanced lighting, clean background, and no distortions, text, or artifacts.
Output only one photorealistic image showing the person wearing the new dress perfectly.`;
}

async function callGemini(
  personB64,
  personMime,
  dressB64,
  dressMime,
  category,
  crop
) {
  const body = {
    contents: [
      {
        parts: [
          { text: buildPrompt(category, crop) },
          {
            inline_data: {
              mime_type: personMime || "image/png",
              data: personB64,
            },
          },
          {
            inline_data: {
              mime_type: dressMime || "image/png",
              data: dressB64,
            },
          },
        ],
      },
    ],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}: ${text}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Bad JSON: ${text.slice(0, 300)}...`);
  }
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart =
    parts.find((p) => p.inline_data?.data) ||
    parts.find((p) => p.inlineData?.data);
  if (!imgPart) {
    console.error("Gemini no-image payload:", JSON.stringify(json, null, 2));
    const finish = json?.candidates?.[0]?.finishReason || "unknown";
    throw new Error(`No image returned by Gemini (finishReason: ${finish}).`);
  }

  const outB64 = imgPart.inline_data?.data || imgPart.inlineData?.data;
  const outName = `result_${Date.now()}.png`;
  const outPath = path.join(uploadDir, outName);
  await fsp.writeFile(outPath, Buffer.from(outB64, "base64"));
  return `/uploads/${outName}`;
}

// Start job
app.post(
  "/api/tryon",
  upload.fields([{ name: "person" }, { name: "dress" }]),
  async (req, res) => {
    if (!GEMINI_KEY)
      return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
    const person = req.files?.person?.[0];
    const dress = req.files?.dress?.[0];
    const category = req.body?.category || "upper_body";
    const crop = req.body?.crop === "true";
    if (!person || !dress)
      return res
        .status(400)
        .json({ error: "Both person and dress are required" });

    const jobId = Date.now().toString();
    res.json({ job_id: jobId, status: "running" });
    JOBS[jobId] = { status: "running" };

    try {
      const pB64 = await fileToBase64(person.path);
      const dB64 = await fileToBase64(dress.path);
      const outUrl = await callGemini(
        pB64,
        person.mimetype,
        dB64,
        dress.mimetype,
        category,
        crop
      );
      JOBS[jobId] = { status: "done", result_url: outUrl };
    } catch (err) {
      JOBS[jobId] = { status: "error", error: String(err.message || err) };
    }
  }
);

// Poll job
app.get("/api/jobs/:id", (req, res) => {
  const j = JOBS[req.params.id];
  if (!j) return res.status(404).json({ error: "Job not found" });
  res.json(j);
});

app.listen(PORT, () => {
  console.log(`✔ VTO booth running at http://localhost:${PORT}`);
  console.log(
    `Tip: put PNGs in ./assets/dresses to populate the sidebar gallery.`
  );
});

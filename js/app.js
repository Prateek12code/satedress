import { PoseMask } from "./poseMask.js";

(async function main() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("overlay");
  const ctx = canvas.getContext("2d");

  // Start camera
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720 },
  });
  video.srcObject = stream;
  await video.play();

  // Resize canvas to video size
  function resizeCanvas() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  video.addEventListener("loadedmetadata", resizeCanvas);
  window.addEventListener("resize", resizeCanvas);

  // Pose
  const poseMask = new PoseMask(video);
  await poseMask.init();

  // Dress image (will load later)
  let dressImg = null;

  document.getElementById("dressInput").addEventListener("change", (ev) => {
    const f = ev.target.files?.[0];
    if (f) {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        dressImg = img;
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  });

  document.getElementById("snapshotBtn").addEventListener("click", () => {
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "snapshot.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  function drawFrame(keypoints) {
    // Draw video frame
    ctx.save();
    // Mirror horizontally to match user camera flip
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    if (dressImg && keypoints) {
      // Example: place dress with shoulders/hips
      const ls = keypoints[11]; // left_shoulder
      const rs = keypoints[12];
      const lh = keypoints[23];
      const rh = keypoints[24];

      if (ls && rs && lh && rh) {
        // Coordinates are normalized [0,1], need scale
        const xls = ls.x * canvas.width;
        const yls = ls.y * canvas.height;
        const xrs = rs.x * canvas.width;
        const yrs = rs.y * canvas.height;
        const xlh = lh.x * canvas.width;
        const ylh = lh.y * canvas.height;
        const xrh = rh.x * canvas.width;
        const yrh = rh.y * canvas.height;

        // Compute mid shoulders
        const mx = (xls + xrs) / 2;
        const my = (yls + yrs) / 2;

        // Compute width of shoulders
        const shoulderW = Math.hypot(xls - xrs, yls - yrs);

        // Compute torso height
        const hipMidX = (xlh + xrh) / 2;
        const hipMidY = (ylh + yrh) / 2;
        const torsoH = Math.hypot(hipMidX - mx, hipMidY - my);

        // Compute target dress height
        const targetH = Math.max(shoulderW * 3.2, torsoH * 2.2);

        // Scale factor
        const scale = targetH / dressImg.naturalHeight;

        const drawW = dressImg.naturalWidth * scale;
        const drawH = dressImg.naturalHeight * scale;

        // Offset so center top aligns at shoulder mid
        const drawX = mx - drawW / 2;
        const drawY = my - drawH * 0.25;

        ctx.drawImage(dressImg, drawX, drawY, drawW, drawH);
      }
    }
  }

  async function loop(ts) {
    const res = await poseMask.update(ts);
    drawFrame(res.keypoints);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();

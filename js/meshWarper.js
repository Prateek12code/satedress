// js/meshWarper.js
// Pixi v8-friendly: File -> Image -> offscreen Canvas -> CanvasSource -> Texture

export class MeshWarper {
  constructor() {
    this.app = null;
    this.mesh = null; // the dress sprite
    this.texture = null; // PIXI.Texture (v8)
    this.params = { scale: 1.0, offsetX: 0, offsetY: 0, rotation: 0 };
    this.debugBox = null;
  }

  async init() {
    this.app = new PIXI.Application();
    await this.app.init({
      resizeTo: document.querySelector(".stage"),
      backgroundAlpha: 0,
      powerPreference: "high-performance",
      antialias: true,
    });

    const stageEl = document.querySelector(".stage");
    stageEl.appendChild(this.app.canvas);
    Object.assign(this.app.canvas.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2",
    });

    // Handle GPU context loss gracefully
    this.app.canvas.addEventListener("webglcontextlost", (e) => {
      console.warn("Pixi: WebGL context lost");
      e.preventDefault();
    });
    this.app.canvas.addEventListener("webglcontextrestored", () => {
      console.warn("Pixi: WebGL context restored");
      if (this.texture) this._buildSprite();
    });

    // Visible debug so you can see Pixi working before any upload
    const g = new PIXI.Graphics();
    g.beginFill(0xff0000, 0.2);
    g.drawRect(0, 0, 160, 220);
    g.endFill();
    g.position.set(
      this.app.renderer.width / 2 - 80,
      this.app.renderer.height / 2 - 110
    );
    this.app.stage.addChild(g);
    this.debugBox = g;

    console.log(
      "[Pixi] renderer ready, size:",
      this.app.renderer.width,
      this.app.renderer.height
    );
  }

  /**
   * Load a transparent PNG dress from a File object.
   * Flow: File -> dataURL -> Image.decode() -> draw to canvas -> CanvasSource -> Texture
   */
  async loadDressFile(file) {
    console.log("loadDressFile:", file?.name, file?.size, file?.type);

    // 1) File -> dataURL
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

    // 2) Decode to Image (guarantees pixels are ready)
    const img = new Image();
    img.crossOrigin = "anonymous"; // avoid tainted canvas
    img.decoding = "async";
    img.src = dataUrl;
    await img.decode();

    // 3) Draw onto an offscreen canvas (Canvas is an approved TextureSource in v8)
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.drawImage(img, 0, 0);

    // 4) Create a CanvasSource, then a Texture (v8-way)
    // https://pixijs.com/8.x/guides/migrations/v8  (TextureSource + Texture)
    // https://pixijs.download/dev/docs/rendering.CanvasSource.html
    const source = new PIXI.CanvasSource({
      resource: canvas,
      // Optional tuning (uncomment if you want):
      // scaleMode: 'linear', // or 'nearest'
      // autoGenerateMipmaps: false,
    });

    this.texture = new PIXI.Texture({ source });

    if (!this.texture || !this.texture.valid) {
      console.error("Texture invalid from CanvasSource");
      throw new Error("Texture invalid");
    }

    this._buildSprite();
  }

  _buildSprite() {
    if (!this.texture) {
      console.warn("buildSprite: no texture");
      return;
    }

    // Clear old stuff
    if (this.mesh) {
      this.app.stage.removeChild(this.mesh);
      this.mesh.destroy(true);
      this.mesh = null;
    }
    if (this.debugBox) {
      this.app.stage.removeChild(this.debugBox);
      this.debugBox.destroy(true);
      this.debugBox = null;
    }

    // Create sprite
    this.mesh = new PIXI.Sprite(this.texture);
    this.mesh.anchor.set(0.5, 0.25); // pivot near shoulders

    // Initial center placement for immediate visibility
    const w = this.texture.width,
      h = this.texture.height;
    const s = Math.min(
      (this.app.renderer.height * 0.5) / h,
      (this.app.renderer.width * 0.4) / w
    );
    this.mesh.scale.set(s > 0 ? s : 0.3);
    this.mesh.position.set(
      this.app.renderer.width / 2,
      this.app.renderer.height / 2
    );

    this.app.stage.addChild(this.mesh);
    console.log(
      "[Pixi] sprite added, dimensions:",
      w,
      "x",
      h,
      "scale:",
      this.mesh.scale.x
    );
  }

  setParams(partial) {
    Object.assign(this.params, partial);
  }

  /**
   * Applies pose landmarks to position/scale/rotate the dress.
   * Expects an array with entries having .name and .x/.y in screen pixels:
   * names: left_shoulder, right_shoulder, left_hip, right_hip
   */
  applyPose(keypoints) {
    if (!this.mesh || !keypoints) return;

    const lS = keypoints.find((k) => k.name === "left_shoulder");
    const rS = keypoints.find((k) => k.name === "right_shoulder");
    const lH = keypoints.find((k) => k.name === "left_hip");
    const rH = keypoints.find((k) => k.name === "right_hip");
    if (!lS || !rS || !lH || !rH) return;

    const sx = (lS.x + rS.x) / 2;
    const sy = (lS.y + rS.y) / 2;
    const shoulderW = Math.hypot(lS.x - rS.x, lS.y - rS.y);
    const torsoH = Math.hypot((lH.x + rH.x) / 2 - sx, (lH.y + rH.y) / 2 - sy);
    const targetH = Math.max(shoulderW * 3.2, torsoH * 2.2);

    const s = (targetH / this.texture.height) * this.params.scale;
    this.mesh.scale.set(s > 0 ? s : this.mesh.scale.x);
    this.mesh.position.set(sx + this.params.offsetX, sy + this.params.offsetY);
    this.mesh.rotation = (this.params.rotation * Math.PI) / 180;
  }
}

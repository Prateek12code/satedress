// js/uiControls.js

export class UIControls {
  constructor(meshWarper, videoEl) {
    this.warper = meshWarper;
    this.video = videoEl;

    this.dressInput = document.getElementById("dressInput");
    this.snapshotBtn = document.getElementById("snapshotBtn");
    this.advancedBtn = document.getElementById("advancedBtn");
    this.tuner = document.getElementById("tuner");

    this.scale = document.getElementById("scale");
    this.offsetX = document.getElementById("offsetX");
    this.offsetY = document.getElementById("offsetY");
    this.rotation = document.getElementById("rotation");

    this.stage = document.querySelector(".stage");
    this.debug = document.getElementById("debug");
  }

  log(msg) {
    if (this.debug) {
      this.debug.textContent = String(msg);
    }
  }

  bind() {
    // Click or tap stage to choose file
    this.stage.addEventListener("click", () => this.dressInput.click());

    // Drag & drop support
    ["dragenter", "dragover"].forEach((ev) =>
      this.stage.addEventListener(ev, (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      })
    );
    this.stage.addEventListener("drop", async (e) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f) {
        await this._loadFile(f);
      }
    });

    // File upload via input
    this.dressInput.addEventListener("change", async () => {
      const f = this.dressInput.files?.[0];
      if (!f) {
        this.log("No file selected");
        return;
      }
      await this._loadFile(f);
    });

    // Toggle fine-tune
    this.advancedBtn.addEventListener("click", () => {
      this.tuner.classList.toggle("hidden");
    });

    // Slider inputs
    const updateParams = () => {
      this.warper.setParams({
        scale: parseFloat(this.scale.value),
        offsetX: parseInt(this.offsetX.value, 10),
        offsetY: parseInt(this.offsetY.value, 10),
        rotation: parseFloat(this.rotation.value),
      });
    };
    [this.scale, this.offsetX, this.offsetY, this.rotation].forEach((el) =>
      el.addEventListener("input", updateParams)
    );

    // Snapshot button
    this.snapshotBtn.addEventListener("click", () => {
      if (!this.video.videoWidth) return;
      const c = document.createElement("canvas");
      c.width = this.video.videoWidth;
      c.height = this.video.videoHeight;
      const ctx = c.getContext("2d");

      // Mirror fix: video is mirrored, so flip
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(this.video, -c.width, 0, c.width, c.height);
      ctx.restore();

      // Draw Pixi overlay canvas
      const pixiCanvas = document.querySelector(".stage canvas");
      ctx.drawImage(pixiCanvas, 0, 0, c.width, c.height);

      const a = document.createElement("a");
      a.download = "tryon_snapshot.png";
      a.href = c.toDataURL("image/png");
      a.click();
    });

    this.log("Ready. Click stage or upload PNG.");
  }

  async _loadFile(file) {
    try {
      this.log(`Loading ${file.name} (${Math.round(file.size / 1024)} KB)`);
      await this.warper.loadDressFile(file);
      this.log(`Loaded ${file.name}`);
    } catch (err) {
      console.error("UIControls loadFile error:", err);
      this.log(`Load failed: ${err?.message || err}`);
    }
  }
}

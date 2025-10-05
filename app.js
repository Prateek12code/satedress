(() => {
  // DOM
  const start = document.getElementById("start");
  const btnStart = document.getElementById("btnStart");

  const main = document.getElementById("main");
  const cam = document.getElementById("cam");
  const photo = document.getElementById("photo");
  const resultImg = document.getElementById("resultImg");

  const btnSnap = document.getElementById("btnSnap");
  const btnRetake = document.getElementById("btnRetake");
  const btnWardrobe = document.getElementById("btnWardrobe");
  const btnGenerate = document.getElementById("btnGenerate");

  const sidebar = document.getElementById("sidebar");
  const btnCloseSidebar = document.getElementById("btnCloseSidebar");
  const dressFile = document.getElementById("dressFile");
  const gallery = document.getElementById("gallery");
  const btnChooseDress = document.getElementById("btnChooseDress");
  const chooseHint = document.getElementById("chooseHint");

  const badge = document.getElementById("badge");
  const badgeImg = document.getElementById("badgeImg");
  const badgeLabel = document.getElementById("badgeLabel");

  const generating = document.getElementById("generating");
  const progressMsg = document.getElementById("progressMsg");

  const postActions = document.getElementById("postActions");
  const btnTryAgain = document.getElementById("btnTryAgain");
  const btnRestart = document.getElementById("btnRestart");

  // State
  let stream = null;
  let capturedBlob = null;
  let selectedDress = null; // { url, title }
  let uploadedDressFile = null; // File
  const msgs = ["Analyzing pose", "Fitting garment", "Refining", "Finalizing"];

  // 5 states × men/women (put images at these paths or rename as needed)
  const WARDROBE = [
    {
      title: "Tamil Nadu",
      items: [
        {
          url: "/assets/dresses/tamilnadu/tamil_men_veshti.png",
          name: "Men — Veshti & Shirt",
        },
        {
          url: "/assets/dresses/tamilnadu/tamil_women_saree.png",
          name: "Women — Saree",
        },
      ],
    },
    {
      title: "Kerala",
      items: [
        {
          url: "/assets/dresses/kerala/kerala_men_mundu.png",
          name: "Men — Mundu & Shirt",
        },
        {
          url: "/assets/dresses/kerala/kerala_women_setmundu.png",
          name: "Women — Set Mundu",
        },
      ],
    },
    {
      title: "Gujarat",
      items: [
        {
          url: "/assets/dresses/gujarat/gujarat_men_kediyu.png",
          name: "Men — Kediyu & Dhoti",
        },
        {
          url: "/assets/dresses/gujarat/gujarat_women_chaniya.png",
          name: "Women — Chaniya Choli",
        },
      ],
    },
    {
      title: "Punjab",
      items: [
        {
          url: "/assets/dresses/punjab/punjab_men_kurta.png",
          name: "Men — Kurta Pajama",
        },
        {
          url: "/assets/dresses/punjab/punjab_women_salwar.png",
          name: "Women — Salwar Kameez",
        },
      ],
    },
    {
      title: "Rajasthan",
      items: [
        {
          url: "/assets/dresses/rajasthan/rajasthan_men_angrakha.png",
          name: "Men — Angrakha & Dhoti",
        },
        {
          url: "/assets/dresses/rajasthan/rajasthan_women_ghagra.png",
          name: "Women — Ghagra Choli",
        },
      ],
    },
  ];

  // Helpers
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function urlToFile(url, name) {
    const r = await fetch(url);
    const b = await r.blob();
    return new File([b], name, { type: b.type || "image/png" });
  }
  function updateChooseEnabled() {
    btnChooseDress.disabled = !(selectedDress || uploadedDressFile);
  }

  // Boot
  window.addEventListener("DOMContentLoaded", () => {
    main.classList.add("hidden");
    generating.classList.add("hidden");
    sidebar.classList.add("hidden");
    postActions.hidden = true;
    btnRetake.hidden = true;
    btnWardrobe.hidden = true;
    btnGenerate.hidden = true;
  });

  // Start → camera
  btnStart.onclick = async () => {
    start.classList.add("hidden");
    main.classList.remove("hidden");
    await initCamera();
    btnSnap.hidden = false;
    btnRetake.hidden = true;
    btnWardrobe.hidden = true;
    btnGenerate.hidden = true;
    renderWardrobe(); // pre-render once
  };

  async function initCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      cam.srcObject = stream;
      cam.onloadedmetadata = () => cam.play();
    } catch (err) {
      alert("Camera permission required. Please allow camera.");
      console.error(err);
    }
  }

  // Snap (FIT logic to avoid cutting head/feet)
  btnSnap.onclick = async () => {
    if (!cam.videoWidth) return;
    const w = 900,
      h = 1200; // 3:4 portrait canvas
    photo.width = w;
    photo.height = h;
    const ctx = photo.getContext("2d");

    const vw = cam.videoWidth,
      vh = cam.videoHeight;
    const scale = Math.min(w / vw, h / vh); // FIT (not cover)
    const dw = vw * scale,
      dh = vh * scale;
    const dx = (w - dw) / 2,
      dy = (h - dh) / 2;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(cam, dx, dy, dw, dh);

    capturedBlob = await new Promise((r) => photo.toBlob(r, "image/png", 0.95));

    cam.classList.add("hidden");
    photo.classList.remove("hidden");
    document.getElementById("frameGuide").classList.add("hidden");
    btnSnap.hidden = true;
    btnRetake.hidden = false;
    btnWardrobe.hidden = false;

    openSidebar(); // go pick a dress
  };

  // Retake
  btnRetake.onclick = () => resetToCamera();

  // Sidebar open/close
  function openSidebar() {
    sidebar.classList.remove("hidden");
    requestAnimationFrame(() => sidebar.classList.add("open"));
  }
  btnWardrobe.onclick = openSidebar;
  btnCloseSidebar.onclick = () => {
    sidebar.classList.remove("open");
    setTimeout(() => sidebar.classList.add("hidden"), 280);
  };

  // Wardrobe rendering
  function renderWardrobe() {
    gallery.innerHTML = "";
    WARDROBE.forEach((group) => {
      const g = document.createElement("div");
      g.className = "group";

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = group.title;
      g.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "grid";
      group.items.forEach((item) => grid.appendChild(makeThumb(item)));
      g.appendChild(grid);

      gallery.appendChild(g);
    });
  }

  function clearActive() {
    [...gallery.querySelectorAll(".thumb")].forEach((e) =>
      e.classList.remove("active")
    );
  }

  function makeThumb(item) {
    const d = document.createElement("div");
    d.className = "thumb";
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name;
    const cap = document.createElement("div");
    cap.className = "cap";
    cap.textContent = item.name;
    d.appendChild(img);
    d.appendChild(cap);
    d.onclick = () => {
      clearActive();
      d.classList.add("active");
      selectedDress = {
        url: item.url,
        title: `${item.name} • ${findGroupTitle(item.url)}`,
      };
      uploadedDressFile = null;
      updateChooseEnabled();
      pulseChoose();
    };
    return d;
  }

  function findGroupTitle(url) {
    for (const g of WARDROBE) {
      if (g.items.some((it) => it.url === url)) return g.title;
    }
    return "";
  }

  function pulseChoose() {
    btnChooseDress.classList.add("pulse");
    setTimeout(() => btnChooseDress.classList.remove("pulse"), 600);
  }

  // Upload dress (non-auto-select)
  dressFile.onchange = () => {
    const f = dressFile.files?.[0];
    if (!f) return;
    uploadedDressFile = f;
    selectedDress = null;
    clearActive();
    updateChooseEnabled();

    // visual flash insert
    const blobURL = URL.createObjectURL(f);
    const temp = document.createElement("div");
    temp.className = "thumb flash";
    temp.innerHTML = `<img src="${blobURL}" alt="Uploaded"><div class="cap">Uploaded Dress</div>`;
    const firstGrid = gallery.querySelector(".grid");
    if (firstGrid) {
      firstGrid.prepend(temp);
      setTimeout(() => temp.remove(), 1000);
    }
  };

  // Choose
  btnChooseDress.onclick = () => {
    if (!(selectedDress || uploadedDressFile)) {
      chooseHint.textContent = "Please tap a dress first.";
      chooseHint.style.color = "#ffd166";
      setTimeout(() => {
        chooseHint.textContent = "Tap a dress card, then press “Choose Dress”.";
        chooseHint.style.color = "";
      }, 1500);
      return;
    }
    sidebar.classList.remove("open");
    setTimeout(() => sidebar.classList.add("hidden"), 280);

    // badge preview
    if (uploadedDressFile) {
      const u = URL.createObjectURL(uploadedDressFile);
      badgeImg.src = u;
      badgeLabel.textContent = "Uploaded Dress";
    } else {
      badgeImg.src = selectedDress.url;
      badgeLabel.textContent = selectedDress.title || "";
    }
    badge.classList.remove("hidden");

    btnGenerate.hidden = false;
  };

  // Generate
  btnGenerate.onclick = async () => {
    if (!capturedBlob) return;
    if (!(selectedDress || uploadedDressFile)) return;

    generating.classList.remove("hidden");
    cycleProgress();

    try {
      const fd = new FormData();
      fd.append(
        "person",
        new File([capturedBlob], "person.png", { type: "image/png" })
      );
      if (uploadedDressFile) {
        fd.append("dress", uploadedDressFile);
      } else {
        fd.append("dress", await urlToFile(selectedDress.url, "dress.png"));
      }

      // server.js ignores category/crop, but we send anyway harmlessly
      fd.append("category", "dresses");
      fd.append("crop", "false");

      const kick = await fetch("/api/tryon", { method: "POST", body: fd });
      const job = await kick.json();
      if (!kick.ok) throw new Error(job.error || "start failed");

      let st = job;
      while (st.status === "running") {
        await sleep(1100);
        const r2 = await fetch(`/api/jobs/${job.job_id}`);
        st = await r2.json();
        if (!r2.ok) throw new Error(st.error || "job failed");
      }
      if (st.status === "done") {
        showResult(st.result_url);
      } else {
        throw new Error(st.error || "error");
      }
    } catch (err) {
      console.error(err);
      progressMsg.textContent = "Error — try again";
      await sleep(1400);
      generating.classList.add("hidden");
    }
  };

  function showResult(url) {
    generating.classList.add("hidden");
    resultImg.src = url;
    resultImg.classList.remove("hidden");
    photo.classList.add("hidden");
    btnSnap.hidden = true;
    btnRetake.hidden = true;
    btnWardrobe.hidden = true;
    btnGenerate.hidden = true;
    postActions.hidden = false;
  }

  // Change dress (keep same photo)
  btnTryAgain.onclick = () => {
    resultImg.classList.add("hidden");
    photo.classList.remove("hidden");
    btnWardrobe.hidden = false;
    postActions.hidden = true;
    btnGenerate.hidden = true;
    openSidebar();
  };

  // Back to start
  btnRestart.onclick = () => fullReset();

  function resetToCamera() {
    selectedDress = null;
    uploadedDressFile = null;
    badge.classList.add("hidden");
    resultImg.classList.add("hidden");
    photo.classList.add("hidden");
    cam.classList.remove("hidden");
    document.getElementById("frameGuide").classList.remove("hidden");
    btnSnap.hidden = false;
    btnRetake.hidden = true;
    btnWardrobe.hidden = true;
    btnGenerate.hidden = true;
    postActions.hidden = true;
    sidebar.classList.add("hidden");
    updateChooseEnabled();
  }
  function fullReset() {
    resetToCamera();
    main.classList.add("hidden");
    start.classList.remove("hidden");
  }

  function cycleProgress() {
    let i = 0;
    progressMsg.textContent = msgs[0];
    const iv = setInterval(() => {
      if (generating.classList.contains("hidden")) {
        clearInterval(iv);
        return;
      }
      i = (i + 1) % msgs.length;
      progressMsg.textContent = msgs[i];
    }, 900);
  }
})();

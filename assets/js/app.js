const PROFILE_URL = "./assets/data/profiles.json";
const COLLECTIBLES_URL = "./assets/data/collectibles.generated.json";
const SNAPSHOT_DIR = "./assets/data/profile-snippets";

const SENKURO_CSS = [
  "assets/vendor/senkuro/source/_slug_-CPGSTIMs.css",
  "assets/vendor/senkuro/source/client-CmLIfJvQ.css",
  "assets/vendor/senkuro/source/security-U6eeA1dE.css",
  "assets/vendor/senkuro/source/BaseBanner-WpaAOtR_.css",
  "assets/vendor/senkuro/source/TextExpander-DQVKOmmP.css",
  "assets/vendor/senkuro/source/TiptapRender-BN4Bquya.css",
  "assets/vendor/senkuro/source/CollectibleCardPreview-BUvQEADV.css",
  "assets/vendor/senkuro/source/CollectibleCard-C63z50S9.css",
  "assets/vendor/senkuro/source/RelatedCard-yHlzMfGL.css",
  "assets/vendor/senkuro/source/BaseTag-BzoH9u0U.css",
  "assets/vendor/senkuro/source/floating-vue-EcrtE6ba.css",
  "assets/vendor/senkuro/source/index-local.css"
];

const app = document.querySelector("#app");
const drawer = document.querySelector("#previewDrawer");
const toggleButton = document.querySelector("#previewToggle");
const closeButton = document.querySelector("#previewClose");
const profileSelect = document.querySelector("#profileSelect");
const resetButton = document.querySelector("#resetButton");

const controls = {
  wallpaper: {
    toggle: document.querySelector("#wallpaperToggle"),
    select: document.querySelector("#wallpaperSelect"),
    url: document.querySelector("#wallpaperUrl"),
    file: document.querySelector("#wallpaperFile")
  },
  banner: {
    toggle: document.querySelector("#bannerToggle"),
    select: document.querySelector("#bannerSelect"),
    url: document.querySelector("#bannerUrl"),
    file: document.querySelector("#bannerFile")
  },
  avatar: {
    select: document.querySelector("#avatarSelect"),
    url: document.querySelector("#avatarUrl"),
    file: document.querySelector("#avatarFile")
  },
  frame: {
    toggle: document.querySelector("#frameToggle"),
    select: document.querySelector("#frameSelect"),
    url: document.querySelector("#frameUrl"),
    file: document.querySelector("#frameFile")
  }
};

const typeBySlot = {
  wallpaper: "WALLPAPER",
  banner: "BANNER",
  avatar: "AVATAR",
  frame: "FRAME"
};

let data = { profiles: [] };
let catalog = { items: { AVATAR: [], FRAME: [], BANNER: [], WALLPAPER: [] } };
let renderVersion = 0;
const snippetCache = new Map();

let state = {
  profileId: "",
  device: "desktop",
  enabled: {
    wallpaper: true,
    banner: true,
    frame: true
  },
  cosmetics: {
    wallpaper: null,
    banner: null,
    avatar: null,
    frame: null
  },
  objectUrls: []
};

init().catch((error) => {
  app.className = "app-loading";
  app.textContent = `Не удалось загрузить превью: ${error.message}`;
  console.error(error);
});

async function init() {
  const [profileData, collectibleData] = await Promise.all([
    fetchJson(PROFILE_URL),
    fetchJson(COLLECTIBLES_URL).catch(() => catalog)
  ]);

  data = profileData;
  catalog = normalizeCatalog(collectibleData);
  state.profileId = data.profiles[0]?.id || "";

  applyProfileDefaults();
  bindControls();
  fillProfileSelect();
  fillCatalogSelects();
  syncControls();
  await render();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.text();
}

function normalizeCatalog(source) {
  const items = source.items || source;
  return {
    generatedAt: source.generatedAt || null,
    items: {
      AVATAR: Array.isArray(items.AVATAR) ? items.AVATAR : [],
      FRAME: Array.isArray(items.FRAME) ? items.FRAME : [],
      BANNER: Array.isArray(items.BANNER) ? items.BANNER : [],
      WALLPAPER: Array.isArray(items.WALLPAPER) ? items.WALLPAPER : []
    }
  };
}

function activeProfile() {
  return data.profiles.find((profile) => profile.id === state.profileId) || data.profiles[0];
}

function applyProfileDefaults() {
  const profile = activeProfile();
  if (!profile) return;

  state.cosmetics = {
    wallpaper: profile.cosmetics.wallpaper,
    banner: profile.cosmetics.banner,
    avatar: profile.cosmetics.avatar,
    frame: profile.cosmetics.frame
  };
  state.enabled.banner = Boolean(profile.cosmetics.banner);
  state.enabled.wallpaper = Boolean(profile.cosmetics.wallpaper);
  state.enabled.frame = Boolean(profile.cosmetics.frame);
}

function bindControls() {
  toggleButton.addEventListener("click", () => {
    const shouldOpen = drawer.hasAttribute("hidden");
    drawer.toggleAttribute("hidden", !shouldOpen);
    toggleButton.setAttribute("aria-expanded", String(shouldOpen));
  });

  closeButton.addEventListener("click", () => {
    drawer.hidden = true;
    toggleButton.setAttribute("aria-expanded", "false");
  });

  profileSelect.addEventListener("change", () => {
    state.profileId = profileSelect.value;
    releaseObjectUrls();
    applyProfileDefaults();
    syncControls();
    void render();
  });

  document.querySelectorAll(".segmented__btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.device = button.dataset.device;
      document.querySelectorAll(".segmented__btn").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      void render();
    });
  });

  Object.entries(controls).forEach(([slot, control]) => {
    if (control.toggle) {
      control.toggle.addEventListener("change", () => {
        state.enabled[slot] = control.toggle.checked;
        updateCurrentFrame(slot);
      });
    }

    control.select.addEventListener("change", () => {
      const selected = findCatalogItem(typeBySlot[slot], control.select.value);
      if (!selected) return;
      state.cosmetics[slot] = mediaFromCatalog(selected, slot);
      control.url.value = "";
      updateCurrentFrame(slot);
    });

    control.url.addEventListener("change", () => {
      const value = control.url.value.trim();
      if (!value) return;
      state.cosmetics[slot] = mediaFromUrl(value, slot, value);
      updateCurrentFrame(slot);
    });

    control.file.addEventListener("change", () => {
      const file = control.file.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      state.objectUrls.push(url);
      state.cosmetics[slot] = {
        title: file.name,
        original: url,
        webm: file.type.includes("webm") ? url : null,
        mp4: file.type.includes("mp4") ? url : null,
        kind: file.type.startsWith("video/") ? "video" : "image",
        uploaded: true
      };
      updateCurrentFrame(slot);
    });
  });

  resetButton.addEventListener("click", () => {
    releaseObjectUrls();
    applyProfileDefaults();
    syncControls();
    updateCurrentFrame();
  });
}

function releaseObjectUrls() {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];
}

function fillProfileSelect() {
  profileSelect.innerHTML = data.profiles
    .map((profile) => `<option value="${escapeAttr(profile.id)}">${escapeHtml(profile.name)}</option>`)
    .join("");
  profileSelect.value = state.profileId;
}

function fillCatalogSelects() {
  Object.entries(controls).forEach(([slot, control]) => {
    const type = typeBySlot[slot];
    const current = state.cosmetics[slot]?.slug || "";
    const options = [
      `<option value="">Выбрать из каталога</option>`,
      ...catalog.items[type].map((item) => {
        return `<option value="${escapeAttr(item.slug)}">${escapeHtml(item.title || item.slug)}</option>`;
      })
    ];
    control.select.innerHTML = options.join("");
    control.select.value = current;
  });
}

function syncControls() {
  profileSelect.value = state.profileId;
  document.querySelectorAll(".segmented__btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.device === state.device);
  });

  Object.entries(controls).forEach(([slot, control]) => {
    if (control.toggle) {
      control.toggle.checked = state.enabled[slot];
    }
    control.url.value = "";
    control.file.value = "";
    control.select.value = state.cosmetics[slot]?.slug || "";
  });
}

function findCatalogItem(type, slug) {
  return catalog.items[type].find((item) => item.slug === slug);
}

function mediaFromCatalog(item, slot) {
  const best = bestVariants(item, slot);
  return {
    slug: item.slug,
    title: item.title || item.slug,
    original: item.original || item.image?.original?.url || null,
    webm: best.webm,
    mp4: best.mp4,
    kind: best.webm || best.mp4 ? "video" : "image",
    rating: item.rating || null
  };
}

function bestVariants(item, slot) {
  const variants = item.variants || item.image?.variants || [];
  const target = slot === "wallpaper"
    ? { width: 1920, height: 1080 }
    : slot === "banner"
      ? { width: 1920, height: 480 }
      : null;
  const webm = pickVariant(variants, "WEBM", target);
  const mp4 = pickVariant(variants, "MP4", target);
  return { webm: webm?.url || null, mp4: mp4?.url || null };
}

function pickVariant(variants, format, target) {
  const matching = variants
    .filter((variant) => String(variant.format).toUpperCase() === format)
    .sort((a, b) => {
      if (target) {
        const aTarget = Number(a.width === target.width && a.height === target.height);
        const bTarget = Number(b.width === target.width && b.height === target.height);
        if (aTarget !== bTarget) return bTarget - aTarget;
      }
      return (b.width || 0) - (a.width || 0);
    });
  return matching[0] || null;
}

function mediaFromUrl(url, slot, title = "Custom media") {
  const clean = url.split("?")[0].toLowerCase();
  const isVideo = clean.endsWith(".webm") || clean.endsWith(".mp4") || clean.endsWith(".mov");
  return {
    title,
    original: url,
    webm: clean.endsWith(".webm") ? url : null,
    mp4: clean.endsWith(".mp4") || clean.endsWith(".mov") ? url : null,
    kind: isVideo ? "video" : "image",
    custom: true,
    slot
  };
}

async function render() {
  const currentVersion = ++renderVersion;
  const profile = activeProfile();
  if (!profile) return;

  const snippet = await loadProfileSnippet(profile.id);
  if (currentVersion !== renderVersion) return;

  app.className = "";
  app.innerHTML = `
    <div class="preview-host is-${escapeAttr(state.device)}">
      <div class="preview-host__inner">
        <iframe
          id="profileFrame"
          class="profile-frame is-${escapeAttr(state.device)}"
          title="${escapeAttr(profile.name)}"
          sandbox="allow-same-origin"
        ></iframe>
      </div>
    </div>
  `;

  const frame = document.querySelector("#profileFrame");
  const settleFrame = () => {
    hydrateFrameState(frame);
    resizeFrame(frame);
    requestAnimationFrame(() => resizeFrame(frame));
    setTimeout(() => resizeFrame(frame), 250);
  };
  frame.addEventListener("load", settleFrame);
  frame.srcdoc = buildFrameDocument(profile, snippet);
  [50, 250, 1000, 2500].forEach((delay) => {
    setTimeout(() => {
      if (document.body.contains(frame)) settleFrame();
    }, delay);
  });
}

function updateCurrentFrame(slot = null) {
  const frame = document.querySelector("#profileFrame");
  const doc = frame?.contentDocument;
  const profile = activeProfile();

  if (!frame || !doc || !profile) {
    void render();
    return;
  }

  if (!slot || slot === "wallpaper") applyWallpaper(doc);
  if (!slot || slot === "banner") applyBanner(doc);
  if (!slot || slot === "avatar") applyAvatar(doc, profile);
  if (!slot || slot === "frame") applyFrame(doc);

  removeHydratedPlaceholders(doc);
  hydrateFrameState(frame);
  resizeFrame(frame);
  requestAnimationFrame(() => resizeFrame(frame));
}

async function loadProfileSnippet(profileId) {
  if (!snippetCache.has(profileId)) {
    const text = await fetchText(`${SNAPSHOT_DIR}/${profileId}.html`);
    snippetCache.set(profileId, text);
  }
  return snippetCache.get(profileId);
}

function buildFrameDocument(profile, snippet) {
  const processedSnapshot = processSnapshot(snippet, profile);
  const cssLinks = SENKURO_CSS
    .map((href) => `<link rel="stylesheet" href="${absoluteAssetUrl(href)}">`)
    .join("");

  return `<!doctype html>
<html lang="ru" data-theme="dark" class="${state.device === "mobile" ? "preview-device-mobile" : ""}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(profile.name)}</title>
  ${cssLinks}
  <style>
    html, body { background: var(--bg-primary); overflow-x: hidden; }
    html.preview-device-mobile {
      scrollbar-gutter: auto !important;
      scrollbar-width: none;
    }
    html.preview-device-mobile::-webkit-scrollbar,
    html.preview-device-mobile body::-webkit-scrollbar {
      width: 0;
      height: 0;
    }
    .wrapper { min-height: 100vh; }
    a { cursor: default; pointer-events: none; }
    video.wallpaper-wrapper-media,
    video.client-bg__cover,
    video.collectible-card__video { pointer-events: none; }
    .collectible-card__blurhash { display: none !important; }
    .client-bg .preview-media-fallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .preview-media-video.preview-media-ready + .preview-media-fallback {
      display: none;
    }
    video.wallpaper-wrapper-media::-webkit-media-controls,
    video.client-bg__cover::-webkit-media-controls,
    video.collectible-card__video::-webkit-media-controls {
      display: none !important;
      opacity: 0 !important;
    }
  </style>
</head>
<body>
  <div id="app"><div class="wrapper">${processedSnapshot}</div></div>
</body>
</html>`;
}

function processSnapshot(snippet, profile) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="snapshot-root">${snippet}</div>`, "text/html");
  const root = doc.querySelector("#snapshot-root");

  applyWallpaper(root);
  applyBanner(root);
  applyAvatar(root, profile);
  applyFrame(root);
  applyHydratedSnapshotState(root);
  normalizeSnapshotAssets(root);
  hydrateCardVideos(root, profile);
  hydrateLibraryCovers(root, profile);
  removeHydratedPlaceholders(root);

  return root.innerHTML;
}

function applyHydratedSnapshotState(root) {
  root.querySelectorAll(".text-expander__btn").forEach((button) => {
    button.classList.add("text-expander__btn--hide");
  });
}

function normalizeSnapshotAssets(root) {
  root.querySelectorAll("[src]").forEach((element) => {
    const value = element.getAttribute("src");
    if (value?.startsWith("/assets/")) {
      element.setAttribute("src", localSenkuroAsset(value));
    }
  });

  root.querySelectorAll("[srcset]").forEach((element) => {
    const value = element.getAttribute("srcset");
    if (!value) return;
    element.setAttribute("srcset", value
      .split(",")
      .map((entry) => {
        const [url, descriptor] = entry.trim().split(/\s+/, 2);
        const nextUrl = url?.startsWith("/assets/") ? localSenkuroAsset(url) : url;
        return [nextUrl, descriptor].filter(Boolean).join(" ");
      })
      .join(", "));
  });
}

function hydrateCardVideos(root, profile) {
  const cardVideos = (profile.cards || []).filter((card) => card.video);
  const doc = documentFor(root);
  let fallbackIndex = 0;

  root.querySelectorAll("video.collectible-card__video").forEach((video) => {
    if (video.getAttribute("src") || video.querySelector("source")) return;

    const title = cardTitleForVideo(video);
    const card = cardVideos.find((item) => sameTitle(item.title, title))
      || cardVideos[fallbackIndex++];

    if (!card?.video) {
      video.remove();
      return;
    }

    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("loop", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("preload", "auto");
    video.setAttribute("x-webkit-airplay", "allow");
    if (card.image) video.setAttribute("poster", card.image);

    [card.video, card.videoMp4, card.mp4].filter(Boolean).forEach((url) => {
      const source = doc.createElement("source");
      source.setAttribute("src", url);
      source.setAttribute("type", sourceTypeForUrl(url));
      video.append(source);
    });
  });
}

function removeHydratedPlaceholders(root) {
  root.querySelectorAll(".collectible-card__blurhash").forEach((canvas) => {
    canvas.remove();
  });

  root.querySelectorAll(".cover-wrapper__inner, .avatar-wrapper__img").forEach((wrapper) => {
    if (!wrapper.querySelector("img, video")) return;
    wrapper.querySelectorAll("canvas").forEach((canvas) => {
      canvas.remove();
    });
  });
}

function hydrateLibraryCovers(root, profile) {
  const coversBySlug = profile.library?.coversBySlug || {};
  const items = profile.library?.items || [];
  const doc = documentFor(root);
  const hasCoverData = Object.keys(coversBySlug).length || items.some((item) => isMangaCover(item.cover));
  if (!hasCoverData) return;

  root.querySelectorAll(".client-body__item").forEach((section) => {
    const caption = section.querySelector(".caption-top .caption")?.textContent || "";
    if (!caption.includes("Библиотека манги")) return;

    section.querySelectorAll(".card-main").forEach((card) => {
      const wrapper = card.querySelector(".cover-wrapper__inner");
      if (!wrapper) return;

      const title = card.querySelector(".card-title")?.getAttribute("title")
        || card.querySelector(".card-title")?.textContent
        || "";
      const slug = mangaSlugFromCard(card);
      const item = items.find((candidate) => sameTitle(candidate.title, title));
      const cover = coversBySlug[slug] || (isMangaCover(item?.cover) ? item.cover : null);
      if (!cover) return;

      let img = wrapper.querySelector("img");
      if (!img) {
        img = doc.createElement("img");
        wrapper.append(img);
      }

      img.setAttribute("src", cover);
      img.setAttribute("alt", title || item?.title || "Манга");
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("class", "");
    });
  });
}

function mangaSlugFromCard(card) {
  const href = card.closest("a[href*='/manga/']")?.getAttribute("href")
    || card.querySelector("a[href*='/manga/']")?.getAttribute("href")
    || "";
  return href.match(/\/manga\/([^/]+)/)?.[1] || "";
}

function isMangaCover(url) {
  const value = String(url || "");
  if (value.includes("/manga/") && value.includes("/covers/")) return true;

  const encoded = value.split("/").pop()?.replace(/\.\w+$/, "");
  if (!encoded) return false;

  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    return decoded.includes("/manga/") && decoded.includes("/covers/");
  } catch {
    return false;
  }
}

function cardTitleForVideo(video) {
  const card = video.closest(".collectible-card");
  const backAlt = card?.querySelector(".collectible-card__back")?.getAttribute("alt") || "";
  const match = backAlt.match(/^Рубашка карты\s+(.+)$/i);
  return match?.[1] || card?.querySelector("[alt]")?.getAttribute("alt") || "";
}

function sameTitle(left, right) {
  return normalizeTitle(left) === normalizeTitle(right);
}

function normalizeTitle(value) {
  return String(value || "")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceTypeForUrl(url) {
  const clean = String(url || "").split("?")[0].toLowerCase();
  if (clean.endsWith(".mp4")) return "video/mp4";
  if (clean.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

function applyWallpaper(root) {
  const wrapper = root.querySelector(".wallpaper-wrapper");
  if (!wrapper) return;

  if (!state.enabled.wallpaper || !state.cosmetics.wallpaper) {
    wrapper.removeAttribute("style");
    wrapper.innerHTML = "";
    return;
  }

  wrapper.classList.add("client-wallpaper");
  applyMediaFallback(wrapper, state.cosmetics.wallpaper, "center top");
  wrapper.innerHTML = renderMedia(state.cosmetics.wallpaper, "wallpaper-wrapper-media", "", {
    backgroundPosition: "center top"
  });
}

function applyBanner(root) {
  const container = root.querySelector(".container--wallpaper");
  const top = root.querySelector(".client-top");
  if (!container || !top) return;

  let banner = top.querySelector(".banner-wrapper.client-bg");
  const enabled = Boolean(state.enabled.banner && state.cosmetics.banner);
  container.classList.toggle("container--banner", enabled);

  if (!enabled) {
    banner?.remove();
    return;
  }

  if (!banner) {
    banner = documentFor(root).createElement("div");
    banner.className = "banner-wrapper client-bg";
    top.insertBefore(banner, top.querySelector(".client-panel") || top.firstChild);
  }

  applyMediaFallback(banner, state.cosmetics.banner, "center");
  banner.innerHTML = renderMedia(state.cosmetics.banner, "client-bg__cover", "", {
    backgroundPosition: "center"
  });
}

function applyAvatar(root, profile) {
  const avatar = root.querySelector(".client-panel__avatar .avatar-wrapper__img img");
  if (!avatar) return;
  const media = state.cosmetics.avatar || profile.cosmetics.avatar;
  if (!media?.original) return;
  avatar.setAttribute("src", media.original);
  avatar.setAttribute("alt", profile.name);
}

function applyFrame(root) {
  const avatar = root.querySelector(".client-panel__avatar .avatar");
  const avatarPic = root.querySelector(".client-panel__avatar .avatar-pic");
  if (!avatar || !avatarPic) return;

  let frame = avatar.querySelector(".avatar-frame");
  const enabled = Boolean(state.enabled.frame && state.cosmetics.frame?.original);

  if (!enabled) {
    frame?.remove();
    return;
  }

  if (!frame) {
    frame = documentFor(root).createElement("div");
    frame.className = "avatar-frame";
    avatar.insertBefore(frame, avatarPic);
  }

  frame.innerHTML = `<img src="${escapeAttr(state.cosmetics.frame.original)}" alt="avatar frame">`;
}

function renderMedia(media, className, alt, options = {}) {
  const source = media?.mp4 || media?.webm;
  if (source) {
    const sources = [
      media.mp4 ? `<source src="${escapeAttr(media.mp4)}" type="video/mp4">` : "",
      media.webm ? `<source src="${escapeAttr(media.webm)}" type="video/webm">` : "",
      media.original ? `<source src="${escapeAttr(media.original)}">` : ""
    ].join("");
    const poster = media.original ? ` poster="${escapeAttr(media.original)}"` : "";
    const style = mediaStyle(media, options.backgroundPosition);
    const fallback = media.original
      ? `<img class="${escapeAttr(`${className} preview-media-fallback`)}" src="${escapeAttr(media.original)}" alt="${escapeAttr(alt)}">`
      : "";
    return `<video autoplay muted loop pip="false" playsinline preload="auto" x-webkit-airplay="allow" webkit-playsinline class="${escapeAttr(`${className} preview-media-video`)}"${poster}${style}>${sources}</video>${fallback}`;
  }

  if (media?.original) {
    return `<img class="${escapeAttr(className)}" src="${escapeAttr(media.original)}" alt="${escapeAttr(alt)}">`;
  }

  return "";
}

function applyMediaFallback(element, media, backgroundPosition) {
  if (!media?.original) {
    element.removeAttribute("style");
    return;
  }

  element.style.backgroundImage = `url("${escapeCssUrl(media.original)}")`;
  element.style.backgroundSize = "cover";
  element.style.backgroundPosition = backgroundPosition;
}

function mediaStyle(media, backgroundPosition = "center") {
  if (!media?.original) return "";
  const declarations = [
    `background-image:url(&quot;${escapeAttr(escapeCssUrl(media.original))}&quot;)`,
    "background-size:cover",
    `background-position:${escapeAttr(backgroundPosition)}`,
    "object-fit:cover"
  ];
  return ` style="${declarations.join(";")}"`;
}

function absoluteAssetUrl(href) {
  return new URL(href, window.location.href).href;
}

function localSenkuroAsset(pathname) {
  const filename = pathname.replace(/^\/assets\//, "");
  return absoluteAssetUrl(`assets/vendor/senkuro/${filename}`);
}

function documentFor(root) {
  return root.ownerDocument || root;
}

function resizeFrame(frame) {
  frame.style.height = "";
}

function hydrateFrameState(frame) {
  const doc = frame.contentDocument;
  if (!doc) return;

  doc.querySelectorAll(".text-expander").forEach((expander) => {
    const button = expander.querySelector(".text-expander__btn");
    if (!button) return;
    button.classList.add("text-expander__btn--hide");
  });

  doc.querySelectorAll("video.wallpaper-wrapper-media, video.client-bg__cover, video.collectible-card__video").forEach((video) => {
    if (video.dataset.previewHydrated === "true") return;
    video.dataset.previewHydrated = "true";
    video.controls = false;
    video.muted = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    const markReady = () => {
      const isReady = video.readyState >= 2;
      video.classList.toggle("preview-media-ready", isReady);
      if (isReady) {
        const host = video.closest(".wallpaper-wrapper, .client-bg");
        if (host) host.style.backgroundImage = "";
      }
    };
    video.addEventListener("loadeddata", markReady, { once: true });
    video.addEventListener("canplay", markReady, { once: true });
    markReady();
    const playback = video.play();
    if (playback?.catch) playback.catch(() => {});
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeCssUrl(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "")
    .replaceAll("\r", "");
}

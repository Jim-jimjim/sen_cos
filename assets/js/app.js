const PROFILE_URL = "./assets/data/profiles.json";
const COLLECTIBLES_URL = "./assets/data/collectibles.generated.json";

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
  render();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.json();
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
    render();
  });

  document.querySelectorAll(".segmented__btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.device = button.dataset.device;
      document.querySelectorAll(".segmented__btn").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      render();
    });
  });

  Object.entries(controls).forEach(([slot, control]) => {
    if (control.toggle) {
      control.toggle.addEventListener("change", () => {
        state.enabled[slot] = control.toggle.checked;
        render();
      });
    }

    control.select.addEventListener("change", () => {
      const selected = findCatalogItem(typeBySlot[slot], control.select.value);
      if (!selected) return;
      state.cosmetics[slot] = mediaFromCatalog(selected, slot);
      control.url.value = "";
      render();
    });

    control.url.addEventListener("change", () => {
      const value = control.url.value.trim();
      if (!value) return;
      state.cosmetics[slot] = mediaFromUrl(value, slot, value);
      render();
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
      render();
    });
  });

  resetButton.addEventListener("click", () => {
    releaseObjectUrls();
    applyProfileDefaults();
    syncControls();
    render();
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
  const target = slot === "wallpaper" ? { width: 1920, height: 1080 } : slot === "banner" ? { width: 1920, height: 480 } : null;
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

function render() {
  const profile = activeProfile();
  if (!profile) return;

  const isBannerEnabled = Boolean(state.enabled.banner && state.cosmetics.banner);
  app.className = "";
  app.innerHTML = `
    <div class="preview-stage is-${state.device}">
      ${renderWallpaper()}
      ${renderDesktopNav(profile)}
      ${renderMobileTopbar(profile)}
      <main class="client">
        <section class="container container--wallpaper ${isBannerEnabled ? "container--banner" : ""}">
          <div class="client-top">
            ${isBannerEnabled ? renderBanner() : ""}
            ${renderClientPanel(profile)}
          </div>
          ${renderBody(profile)}
        </section>
      </main>
      ${renderMobileBottomNav()}
    </div>
  `;
}

function renderWallpaper() {
  if (!state.enabled.wallpaper || !state.cosmetics.wallpaper) {
    return `<div class="wallpaper-wrapper client-wallpaper"><div class="wallpaper-placeholder"></div></div>`;
  }
  return `<div class="wallpaper-wrapper client-wallpaper">${renderMedia(state.cosmetics.wallpaper, "wallpaper-wrapper-media", "")}</div>`;
}

function renderBanner() {
  return `<div class="banner-wrapper client-bg">${renderMedia(state.cosmetics.banner, "client-bg__cover", "")}</div>`;
}

function renderClientPanel(profile) {
  return `
    <div class="client-panel">
      <a class="client-panel__avatar" href="#" aria-label="${escapeAttr(profile.name)}">
        ${state.enabled.frame && state.cosmetics.frame ? `<img class="avatar-frame" src="${escapeAttr(state.cosmetics.frame.original)}" alt="avatar frame">` : ""}
        <img class="avatar-image" src="${escapeAttr(state.cosmetics.avatar?.original || profile.cosmetics.avatar.original)}" alt="${escapeAttr(profile.name)}">
        <span class="client-panel__avatar-online"></span>
      </a>
      <div class="client-panel__info">
        <div class="client-header">
          <h1 class="caption caption-size-lg">${escapeHtml(profile.name)}</h1>
          ${profile.badge ? `<img class="client-badge" src="${escapeAttr(profile.badge)}" alt="">` : ""}
          ${profile.verified ? `<span class="verified-mark">✓</span>` : ""}
          <a class="lvl" href="#">
            <span class="lvl__tag">${profile.level}</span>
            <span class="lvl__text">${state.device === "mobile" ? "Ур." : "Уровень"}</span>
          </a>
        </div>
        <div class="client-info">
          <div class="client-info__desc">${escapeHtml(profile.statusText)}</div>
          <div class="client-info__cnt">
            ${renderMobileCounter(profile.friends.count, "Друзей", profile.friends.items)}
            ${renderMobileCounter(profile.following.count, "Подписок", profile.following.items)}
          </div>
        </div>
      </div>
      <div class="client-nav">
        <button class="button button--secondary" type="button">Написать</button>
        <button class="button button--accent" type="button">Добавить в друзья</button>
        <button class="button button--secondary button--icon" type="button" aria-label="more options">...</button>
      </div>
    </div>
  `;
}

function renderMobileCounter(count, label, items) {
  return `
    <a class="client-info__item" href="#">
      <span class="client-info__avatars">${items.slice(0, 3).map((item) => `<img src="${escapeAttr(item.avatar)}" alt="${escapeAttr(item.name)}">`).join("")}</span>
      <span class="client-info__item-text">${count} ${label}</span>
    </a>
  `;
}

function renderBody(profile) {
  return `
    <div class="client-body">
      <section class="client-body__cnt">
        ${renderCardsSection(profile)}
        ${renderAchievementsSection(profile)}
        ${renderLibrarySection(profile)}
        ${renderRelationshipsSection(profile, true)}
      </section>
      <aside class="client-body__aside">
        ${renderHistoryAside(profile)}
        ${renderAboutAside(profile)}
        ${renderGuildAside(profile)}
        ${renderStatsAside(profile)}
        ${renderFriendsAside(profile)}
        ${renderTeamsAside(profile)}
        ${renderRelationshipsSection(profile, false)}
      </aside>
    </div>
  `;
}

function renderCardsSection(profile) {
  return `
    <article class="client-body__item">
      <div class="client-body__header">
        <h2 class="caption caption-size-md">Коллекционные карточки</h2>
        <div class="section-actions">
          <a class="section-action" href="#">Предложить обмен</a>
          <a class="section-action" href="#">Все карточки</a>
        </div>
      </div>
      <div class="user-slider user-slider__cards">
        <div class="user-slider__container">
          ${profile.cards.map(renderCollectibleCard).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderCollectibleCard(card) {
  const media = card.video
    ? renderMedia({ webm: card.video, original: card.image, kind: "video" }, "", card.title)
    : `<img src="${escapeAttr(card.image)}" alt="${escapeAttr(card.title)}">`;
  return `
    <a class="collectible-card ${card.rare ? "collectible-card--rare" : ""}" href="#">
      ${media}
      <span class="collectible-card__grade">${escapeHtml(card.grade)}</span>
      <span class="collectible-card__title">${escapeHtml(card.title)}</span>
      <span class="collectible-card__sub">${escapeHtml(card.subtitle)}</span>
    </a>
  `;
}

function renderAchievementsSection(profile) {
  return `
    <article class="client-body__item">
      <div class="client-body__header">
        <h2 class="caption caption-size-md">Достижения <span class="heading-count">${profile.achievements.total}</span></h2>
        <div class="section-actions"><a class="section-action" href="#">Все достижения</a></div>
      </div>
      <div class="user-slider">
        <div class="achievement-row">
          ${profile.achievements.items.map((src) => `<a class="user-achievement" href="#"><img src="${escapeAttr(src)}" alt=""></a>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderLibrarySection(profile) {
  return `
    <article class="client-body__item">
      <div class="client-body__header">
        <h2 class="caption caption-size-md">Библиотека манги <span class="heading-count">${profile.library.total}</span></h2>
        <div class="section-actions"><a class="section-action" href="#">Вся манга</a></div>
      </div>
      <div class="client-tabs">
        ${profile.library.tabs.map((tab, index) => `
          <a class="client-tabs__item ${index === 0 ? "is-active" : ""}" href="#">
            ${escapeHtml(tab.label)} <span class="client-tabs__count">${tab.count}</span>
          </a>
        `).join("")}
      </div>
      <div class="user-slider">
        <div class="user-slider__container">
          ${profile.library.items.map(renderMangaCard).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderMangaCard(item) {
  return `
    <article class="card-main">
      <a href="#">
        <div class="card-main__cover">
          <img src="${escapeAttr(item.cover)}" alt="${escapeAttr(item.title)}">
          <span class="card-main__tag">${escapeHtml(item.type)}</span>
          ${item.status ? `<span class="card-main__status">${escapeHtml(item.status)}</span>` : ""}
        </div>
        <h3 class="card-title">${escapeHtml(item.title)}</h3>
      </a>
    </article>
  `;
}

function renderHistoryAside(profile) {
  return `
    <article class="card card--other">
      <div class="card__header"><h2 class="card__title">История действий</h2></div>
      <div class="history-list">
        ${profile.history.map((item) => `
          <div class="history-item">
            <img src="${escapeAttr(item.cover)}" alt="">
            <div>
              <div class="history-item__time">${escapeHtml(item.time)}</div>
              <div class="history-item__title">${escapeHtml(item.title)}</div>
              <div class="history-item__meta">${escapeHtml(item.meta)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderAboutAside(profile) {
  return `
    <article class="card card--other">
      <div class="card__header"><h2 class="card__title">Обо мне</h2></div>
      <div class="info-list">
        <div>
          <div class="info-label">Описание</div>
          <div class="info-value">${escapeHtml(profile.about.description)}</div>
        </div>
        <div>
          <div class="info-label">День рождения</div>
          <div class="info-value">${escapeHtml(profile.about.birthday)}</div>
        </div>
        <div>
          <div class="info-label">Пол</div>
          <div class="info-value">${escapeHtml(profile.about.gender)}</div>
        </div>
        <div>
          <div class="info-label">Ссылки</div>
          <div class="info-value">${escapeHtml(profile.about.links)}</div>
        </div>
      </div>
    </article>
  `;
}

function renderGuildAside(profile) {
  return `
    <article class="card card--other">
      <div class="card__header"><h2 class="card__title">Гильдия</h2></div>
      <div class="guild-card">
        <img src="${escapeAttr(profile.guild.avatar)}" alt="${escapeAttr(profile.guild.name)}">
        <div>
          <div class="guild-card__name guild-text-color--sunset_red">${escapeHtml(profile.guild.name)}</div>
          <div class="history-item__meta">${profile.guild.level} Уровень</div>
        </div>
      </div>
    </article>
  `;
}

function renderStatsAside(profile) {
  return `
    <article class="card card--other">
      <div class="card__header"><h2 class="card__title">Статистика</h2></div>
      <div class="user-stats">
        ${profile.stats.items.map((item) => `
          <div class="user-stats__item user-stats__item--${escapeAttr(item.tone)}">
            <span class="user-stats__icon"></span>
            <div class="user-stats__body">
              <div class="user-stats__count">${escapeHtml(item.value)}</div>
              <div class="user-stats__text">${escapeHtml(item.label)}</div>
            </div>
          </div>
        `).join("")}
        <div class="user-stats__result">${escapeHtml(profile.stats.rank)}</div>
      </div>
    </article>
  `;
}

function renderFriendsAside(profile) {
  return `
    <article class="card card--other">
      <div class="card__header"><h2 class="card__title">Друзья <span class="heading-count">${profile.friends.count}</span></h2></div>
      <div class="friend-list">
        ${profile.friends.items.slice(0, 12).map((friend) => `<img class="friend-avatar" src="${escapeAttr(friend.avatar)}" alt="${escapeAttr(friend.name)}">`).join("")}
      </div>
    </article>
  `;
}

function renderTeamsAside(profile) {
  return `
    <article class="card card--other">
      <div class="card__header"><h2 class="card__title">В составе команд</h2></div>
      <div class="team-list">
        ${profile.teams.map((team) => `
          <div class="team-item">
            <img src="${escapeAttr(team.avatar)}" alt="${escapeAttr(team.name)}">
            <div>
              <div class="team-item__title">${escapeHtml(team.name)}</div>
              <div class="team-item__meta">${escapeHtml(team.role)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderRelationshipsSection(profile, mobile) {
  return `
    <article class="${mobile ? "client-body__item client-body__item--mobile" : "card card--other"}">
      <div class="${mobile ? "client-body__header" : "card__header"}">
        <h2 class="${mobile ? "caption caption-size-md" : "card__title"}">${escapeHtml(profile.relationships.title)} <span class="heading-count">${profile.relationships.items.length}</span></h2>
      </div>
      <div class="relation-list">
        ${profile.relationships.items.map((item) => `
          <article class="relation-card">
            <div class="relation-card__media"><img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)}"></div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.role)}</p>
          </article>
        `).join("")}
      </div>
    </article>
  `;
}

function renderDesktopNav(profile) {
  return `
    <nav class="site-nav" aria-label="Senkuro">
      <div class="site-nav__inner">
        <a class="site-nav__logo" href="#">SENKURO</a>
        <span class="site-nav__spacer"></span>
        <a class="nav-button" href="#"><span class="nav-icon"></span>Поиск</a>
        <a class="nav-button" href="#"><span class="nav-icon"></span>Каталог</a>
        <a class="nav-button" href="#"><span class="nav-icon"></span>Экосистема</a>
        <span class="site-nav__spacer"></span>
        <a class="nav-button" href="#" aria-label="Закладки"><span class="nav-icon"></span></a>
        <a class="nav-button" href="#" aria-label="Уведомление"><span class="nav-icon"></span></a>
        <a class="nav-avatar" href="#">
          ${state.enabled.frame && state.cosmetics.frame ? `<img class="nav-avatar__frame" src="${escapeAttr(state.cosmetics.frame.original)}" alt="avatar frame">` : ""}
          <img class="nav-avatar__image" src="${escapeAttr(state.cosmetics.avatar?.original || profile.cosmetics.avatar.original)}" alt="${escapeAttr(profile.name)}">
        </a>
      </div>
    </nav>
  `;
}

function renderMobileTopbar(profile) {
  return `
    <nav class="mobile-topbar" aria-label="Senkuro mobile">
      <button class="button button--secondary button--icon" type="button" aria-label="Назад">‹</button>
      <div class="mobile-topbar__title">${escapeHtml(profile.name)}</div>
      <button class="button button--secondary button--icon" type="button" aria-label="Меню">...</button>
    </nav>
  `;
}

function renderMobileBottomNav() {
  return `
    <nav class="mobile-bottom-nav" aria-label="Нижняя навигация">
      ${["Главная", "Каталог", "Моё", "Уведы", "Ещё"].map((item) => `
        <a class="mobile-bottom-nav__item" href="#"><span class="mobile-bottom-nav__icon"></span>${item}</a>
      `).join("")}
    </nav>
  `;
}

function renderMedia(media, className, alt) {
  const classes = className ? ` class="${escapeAttr(className)}"` : "";
  if (!media) return "";
  if (media.webm || media.mp4 || media.kind === "video") {
    return `
      <video${classes} autoplay loop muted playsinline preload="auto" poster="${escapeAttr(media.original || "")}">
        ${media.webm ? `<source src="${escapeAttr(media.webm)}" type="video/webm">` : ""}
        ${media.mp4 ? `<source src="${escapeAttr(media.mp4)}" type="video/mp4">` : ""}
        ${media.original ? `<source src="${escapeAttr(media.original)}">` : ""}
      </video>
    `;
  }
  return `<img${classes} src="${escapeAttr(media.original)}" alt="${escapeAttr(alt || media.title || "")}">`;
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

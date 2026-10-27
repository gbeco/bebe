import {
  db,
  auth
} from "./firebase.js";


import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from
"https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";


const WORKER_BASE =
  "https://hajin-album-api.madocho.workers.dev";


const TIMEZONE =
  "Asia/Seoul";


// =====================================================
// State
// =====================================================

let allMedia = [];

let currentViewerItems = [];

let currentViewerIndex = 0;

let isAdmin = false;

let currentUser = null;


const googleProvider =
  new GoogleAuthProvider();


// =====================================================
// DOM
// =====================================================

const pages =
  document.querySelectorAll(
    ".page"
  );


const navItems =
  document.querySelectorAll(
    ".nav-item"
  );


const pageButtons =
  document.querySelectorAll(
    "[data-page]"
  );


const adminButton =
  document.getElementById(
    "adminButton"
  );


const uploadButton =
  document.getElementById(
    "uploadButton"
  );


const todayGallery =
  document.getElementById(
    "todayGallery"
  );


const recentGallery =
  document.getElementById(
    "recentGallery"
  );


const monthGroups =
  document.getElementById(
    "monthGroups"
  );


const monthPageTitle =
  document.getElementById(
    "monthPageTitle"
  );


const bestGallery =
  document.getElementById(
    "bestGallery"
  );


const allGroups =
  document.getElementById(
    "allGroups"
  );


// Viewer

const mediaViewer =
  document.getElementById(
    "mediaViewer"
  );


const viewerContent =
  document.getElementById(
    "viewerContent"
  );


const viewerClose =
  document.getElementById(
    "viewerClose"
  );


const viewerPrev =
  document.getElementById(
    "viewerPrev"
  );


const viewerNext =
  document.getElementById(
    "viewerNext"
  );


const viewerCounter =
  document.getElementById(
    "viewerCounter"
  );


const viewerDate =
  document.getElementById(
    "viewerDate"
  );


const viewerName =
  document.getElementById(
    "viewerName"
  );


// =====================================================
// 날짜
// =====================================================

function getTakenDate(
  data
) {

  if (
    data.takenAt &&
    typeof data.takenAt.toDate ===
      "function"
  ) {

    return data.takenAt.toDate();

  }


  return null;

}


function getTakenMillis(
  data
) {

  const date =
    getTakenDate(
      data
    );


  return date
    ? date.getTime()
    : 0;

}


// -----------------------------------------------------
// Asia/Seoul 기준 날짜 정보
// -----------------------------------------------------

function getSeoulDateParts(
  date
) {

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          TIMEZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit"
      }
    );


  const parts =
    formatter.formatToParts(
      date
    );


  const values = {};


  parts.forEach(
    (part) => {

      if (
        part.type !==
          "literal"
      ) {

        values[
          part.type
        ] =
          part.value;

      }

    }
  );


  return {

    year:
      Number(
        values.year
      ),

    month:
      Number(
        values.month
      ),

    day:
      Number(
        values.day
      )

  };

}


function getDayKey(
  data
) {

  const date =
    getTakenDate(
      data
    );


  if (!date) {
    return "unknown";
  }


  const parts =
    getSeoulDateParts(
      date
    );


  return (
    String(parts.year) +
    "-" +
    String(
      parts.month
    ).padStart(
      2,
      "0"
    ) +
    "-" +
    String(
      parts.day
    ).padStart(
      2,
      "0"
    )
  );

}


function getMonthKey(
  data
) {

  const date =
    getTakenDate(
      data
    );


  if (!date) {
    return "unknown";
  }


  const parts =
    getSeoulDateParts(
      date
    );


  return (
    String(
      parts.year
    ) +
    "-" +
    String(
      parts.month
    ).padStart(
      2,
      "0"
    )
  );

}


function formatTakenDate(
  data
) {

  const date =
    getTakenDate(
      data
    );


  if (!date) {
    return "";
  }


  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        TIMEZONE,

      year:
        "numeric",

      month:
        "long",

      day:
        "numeric"
    }
  ).format(
    date
  );

}


function formatDayTitle(
  data
) {

  const date =
    getTakenDate(
      data
    );


  if (!date) {

    return "날짜 정보 없음";

  }


  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        TIMEZONE,

      month:
        "long",

      day:
        "numeric",

      weekday:
        "long"
    }
  ).format(
    date
  );

}


function formatMonthTitle(
  data
) {

  const date =
    getTakenDate(
      data
    );


  if (!date) {

    return "날짜 정보 없음";

  }


  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        TIMEZONE,

      year:
        "numeric",

      month:
        "long"
    }
  ).format(
    date
  );

}


// =====================================================
// Page Navigation
// =====================================================

function showPage(
  pageName,
  updateHash = true
) {

  const validPages =
    [
      "home",
      "month",
      "best",
      "all"
    ];


  if (
    !validPages.includes(
      pageName
    )
  ) {

    pageName =
      "home";

  }


  pages.forEach(
    (page) => {

      page.classList.toggle(
        "active",
        page.id ===
          "page-" +
          pageName
      );

    }
  );


  navItems.forEach(
    (item) => {

      item.classList.toggle(
        "active",
        item.dataset.page ===
          pageName
      );

    }
  );


  if (updateHash) {

    history.replaceState(
      null,
      "",
      "#" + pageName
    );

  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


pageButtons.forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  }
);

// =====================================================
// Admin Authentication
// =====================================================

async function checkAdmin(
  user
) {
  if (!user) {
    return false;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "admins",
        user.uid
      )
    );

  return (
    snapshot.exists() &&
    snapshot.data().enabled ===
      true
  );
}

function updateAdminUI() {
  if (
    isAdmin &&
    currentUser
  ) {

    adminButton.textContent =
      "✓";

    adminButton.classList.add(
      "admin-active"
    );

    adminButton.setAttribute(
      "aria-label",
      "관리자 로그아웃"
    );

    adminButton.title =
      "관리자 로그아웃";

    uploadButton.hidden =
      false;
  }

  else {
    adminButton.textContent =
      "⚙️";

    adminButton.classList.remove(
      "admin-active"
    );

    adminButton.setAttribute(
      "aria-label",
      "관리자 로그인"
    );

    adminButton.title =
      "관리자 로그인";

    uploadButton.hidden =
      true;
  }
}

adminButton.addEventListener(
  "click",
  async () => {
    try {
      // 이미 관리자 로그인 상태
      if (
        currentUser &&
        isAdmin
      ) {
        const logout =
          window.confirm(
            "관리자 로그아웃을 할까요?"
          );

        if (!logout) {
          return;
        }

        await signOut(
          auth
        );

        return;
      }

      // Google 로그인
      await signInWithPopup(
        auth,
        googleProvider
      );
    }

    catch (error) {
      console.error(
        "로그인 오류",
        error
      );

      alert(
        "Google 로그인에 실패했습니다."
      );
    }
  }
);

// 기존 Worker 업로드 화면
uploadButton.addEventListener(
  "click",
  () => {

    window.location.href =
      WORKER_BASE +
      "/auth/test-page";
  }
);

// 로그인 상태 관찰
onAuthStateChanged(
  auth,
  async (user) => {

    currentUser =
      user;

    if (!user) {
      isAdmin =
        false;

      updateAdminUI();
      renderViews();
      
      return;
    }

    try {
      isAdmin =
        await checkAdmin(
          user
        );

      if (!isAdmin) {
        alert(
          "관리자로 등록되지 않은 계정입니다."
        );

        await signOut(
          auth
        );

        return;
      }

      updateAdminUI();

      renderViews();
    }

    catch (error) {
      console.error(
        "관리자 확인 오류",
        error
      );

      isAdmin =
        false;

      updateAdminUI();
    }
  }
);


// =====================================================
// Media URL
// =====================================================

function getMediaUrl(
  data
) {

  return (
    WORKER_BASE +
    "/media/" +
    encodeURIComponent(
      data.id
    ) +
    "/original"
  );

}


function getThumbnailUrl(
  data
) {

  return (
    WORKER_BASE +
    "/media/" +
    encodeURIComponent(
      data.id
    ) +
    "/thumbnail"
  );

}


// =====================================================
// Viewer
// =====================================================

function renderViewer() {

  if (
    currentViewerItems.length ===
      0
  ) {

    return;

  }


  const data =
    currentViewerItems[
      currentViewerIndex
    ];


  viewerContent.innerHTML =
    "";


  const mediaUrl =
    getMediaUrl(
      data
    );


  if (
    data.mediaType ===
      "video"
  ) {

    const video =
      document.createElement(
        "video"
      );


    video.src =
      mediaUrl;


    video.controls =
      true;


    video.playsInline =
      true;


    video.preload =
      "metadata";


    viewerContent.appendChild(
      video
    );

  }

  else {

    const image =
      document.createElement(
        "img"
      );


    image.src =
      mediaUrl;


    image.alt =
      data.name || "";


    image.decoding =
      "async";


    viewerContent.appendChild(
      image
    );

  }


  viewerCounter.textContent =
    String(
      currentViewerIndex +
      1
    ) +
    " / " +
    String(
      currentViewerItems.length
    );


  viewerDate.textContent =
    formatTakenDate(
      data
    );


  viewerName.textContent =
    data.name || "";


  const showArrows =
    currentViewerItems.length >
      1;


  viewerPrev.style.display =
    showArrows
      ? "block"
      : "none";


  viewerNext.style.display =
    showArrows
      ? "block"
      : "none";

}


function openViewer(
  items,
  index
) {

  currentViewerItems =
    items;


  currentViewerIndex =
    index;


  renderViewer();


  mediaViewer.classList.add(
    "open"
  );


  mediaViewer.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.style.overflow =
    "hidden";

}


function closeViewer() {

  mediaViewer.classList.remove(
    "open"
  );


  mediaViewer.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.style.overflow =
    "";


  viewerContent.innerHTML =
    "";

}


function showPrevious() {

  if (
    currentViewerItems.length ===
      0
  ) {

    return;

  }


  currentViewerIndex =
    (
      currentViewerIndex -
      1 +
      currentViewerItems.length
    ) %
    currentViewerItems.length;


  renderViewer();

}


function showNext() {

  if (
    currentViewerItems.length ===
      0
  ) {

    return;

  }


  currentViewerIndex =
    (
      currentViewerIndex +
      1
    ) %
    currentViewerItems.length;


  renderViewer();

}


// -----------------------------------------------------
// Viewer Events
// -----------------------------------------------------

viewerClose.addEventListener(
  "click",
  closeViewer
);


viewerPrev.addEventListener(
  "click",
  showPrevious
);


viewerNext.addEventListener(
  "click",
  showNext
);


mediaViewer.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
        mediaViewer
    ) {

      closeViewer();

    }

  }
);


document.addEventListener(
  "keydown",
  (event) => {

    if (
      !mediaViewer.classList.contains(
        "open"
      )
    ) {

      return;

    }


    if (
      event.key ===
        "Escape"
    ) {

      closeViewer();

    }


    if (
      event.key ===
        "ArrowLeft"
    ) {

      showPrevious();

    }


    if (
      event.key ===
        "ArrowRight"
    ) {

      showNext();

    }

  }
);


// -----------------------------------------------------
// Mobile Swipe
// -----------------------------------------------------

let touchStartX = 0;
let touchStartY = 0;


mediaViewer.addEventListener(
  "touchstart",
  (event) => {

    if (
      event.touches.length !==
        1
    ) {

      return;

    }


    touchStartX =
      event.touches[0]
        .clientX;


    touchStartY =
      event.touches[0]
        .clientY;

  },
  {
    passive: true
  }
);


mediaViewer.addEventListener(
  "touchend",
  (event) => {

    if (
      event.changedTouches.length !==
        1
    ) {

      return;

    }


    const touchEndX =
      event.changedTouches[0]
        .clientX;


    const touchEndY =
      event.changedTouches[0]
        .clientY;


    const diffX =
      touchEndX -
      touchStartX;


    const diffY =
      touchEndY -
      touchStartY;


    if (
      Math.abs(diffX) <=
      Math.abs(diffY)
    ) {

      return;

    }


    if (
      Math.abs(diffX) <
      50
    ) {

      return;

    }


    if (
      diffX < 0
    ) {

      showNext();

    }

    else {

      showPrevious();

    }

  },
  {
    passive: true
  }
);

// =====================================================
// Favorite
// =====================================================

async function toggleFavorite(
  item,
  button
) {

  if (
    !isAdmin ||
    !currentUser
  ) {

    return;

  }


  const nextValue =
    item.favorite !== true;


  button.disabled =
    true;


  try {

    await updateDoc(
      doc(
        db,
        "media",
        item.id
      ),
      {
        favorite:
          nextValue
      }
    );


    // 현재 메모리 데이터도 즉시 반영

    item.favorite =
      nextValue;


    // 전체 화면을 다시 그림
    renderViews();

  }

  catch (error) {

    console.error(
      "베스트샷 변경 실패",
      error
    );


    alert(
      "베스트샷 변경에 실패했습니다."
    );

  }

}

// =====================================================
// Gallery
// =====================================================

function createMediaCard(
  data,
  index,
  items
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "media-card";


  card.tabIndex = 0;


  const mediaUrl =
    getThumbnailUrl(
      data
    );


  if (
    data.mediaType ===
      "video"
  ) {

    const video =
      document.createElement(
        "video"
      );


    video.className =
      "gallery-media";


    video.src =
      mediaUrl;


    video.preload =
      "metadata";


    video.muted =
      true;


    video.playsInline =
      true;


    card.appendChild(
      video
    );

  }

  else {

    const image =
      document.createElement(
        "img"
      );


    image.className =
      "gallery-media";


    image.src =
      mediaUrl;


    image.alt =
      data.name || "";


    image.loading =
      "lazy";


    image.decoding =
      "async";

    card.appendChild(
      image
    );

  }


  // ---------------------------------------------
// 관리자 Favorite 버튼
// ---------------------------------------------

if (isAdmin) {

  const favoriteButton =
    document.createElement(
      "button"
    );


  favoriteButton.type =
    "button";


  favoriteButton.className =
    "favorite-button";


  if (
    data.favorite === true
  ) {

    favoriteButton.classList.add(
      "active"
    );


    favoriteButton.textContent =
      "♥";

  }

  else {

    favoriteButton.textContent =
      "♡";

  }


  favoriteButton.setAttribute(
    "aria-label",
    data.favorite === true
      ? "베스트샷 해제"
      : "베스트샷 등록"
  );


  favoriteButton.addEventListener(
    "click",
    async (event) => {

      // 사진 전체화면 열림 방지
      event.stopPropagation();


      await toggleFavorite(
        data,
        favoriteButton
      );

    }
  );


  card.appendChild(
    favoriteButton
  );

}


  const info =
    document.createElement(
      "div"
    );


  info.className =
    "media-info";


  const date =
    document.createElement(
      "div"
    );


  date.className =
    "media-date";


  date.textContent =
    formatTakenDate(
      data
    );


  info.appendChild(
    date
  );


  card.appendChild(
    info
  );


  card.addEventListener(
    "click",
    () => {

      openViewer(
        items,
        index
      );

    }
  );


  card.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
          "Enter" ||
        event.key ===
          " "
      ) {

        event.preventDefault();


        openViewer(
          items,
          index
        );

      }

    }
  );


  return card;

}


function renderGrid(
  container,
  items,
  emptyText
) {

  container.innerHTML =
    "";


  if (
    items.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "empty-message";


    empty.textContent =
      emptyText;


    container.appendChild(
      empty
    );


    return;

  }


  items.forEach(
    (item, index) => {

      container.appendChild(
        createMediaCard(
          item,
          index,
          items
        )
      );

    }
  );

}


// =====================================================
// Group Renderer
// =====================================================

function renderGroups(
  container,
  groups,
  titleFormatter
) {

  container.innerHTML =
    "";


  if (
    groups.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "empty-message";


    empty.textContent =
      "등록된 사진이 없습니다.";


    container.appendChild(
      empty
    );


    return;

  }


  groups.forEach(
    (group) => {

      const section =
        document.createElement(
          "section"
        );


      section.className =
        "media-group";


      const heading =
        document.createElement(
          "div"
        );


      heading.className =
        "group-heading";


      const title =
        document.createElement(
          "h3"
        );


      title.className =
        "group-title";


      title.textContent =
        titleFormatter(
          group.items[0]
        );


      const count =
        document.createElement(
          "span"
        );


      count.className =
        "group-count";


      count.textContent =
        String(
          group.items.length
        ) +
        "개";


      heading.appendChild(
        title
      );


      heading.appendChild(
        count
      );


      const grid =
        document.createElement(
          "div"
        );


      grid.className =
        "gallery";


      group.items.forEach(
        (item, index) => {

          grid.appendChild(
            createMediaCard(
              item,
              index,
              group.items
            )
          );

        }
      );


      section.appendChild(
        heading
      );


      section.appendChild(
        grid
      );


      container.appendChild(
        section
      );

    }
  );

}


// =====================================================
// Grouping
// =====================================================

function groupBy(
  items,
  keyFunction
) {

  const map =
    new Map();


  items.forEach(
    (item) => {

      const key =
        keyFunction(
          item
        );


      if (
        !map.has(key)
      ) {

        map.set(
          key,
          []
        );

      }


      map.get(
        key
      ).push(
        item
      );

    }
  );


  return Array.from(
    map.entries()
  ).map(
    ([key, groupItems]) => ({

      key,

      items:
        groupItems

    })
  );

}


// =====================================================
// View Rendering
// =====================================================

function renderViews() {

  const nowParts =
    getSeoulDateParts(
      new Date()
    );


  // ---------------------------------------------------
  // 오늘
  // ---------------------------------------------------

  const todayItems =
    allMedia.filter(
      (item) => {

        const date =
          getTakenDate(
            item
          );


        if (!date) {
          return false;
        }


        const parts =
          getSeoulDateParts(
            date
          );


        return (
          parts.year ===
            nowParts.year &&
          parts.month ===
            nowParts.month &&
          parts.day ===
            nowParts.day
        );

      }
    );


  renderGrid(
    todayGallery,
    todayItems,
    "오늘 촬영한 사진이 아직 없습니다."
  );


  // 최근 12개

  renderGrid(
    recentGallery,
    allMedia.slice(
      0,
      12
    ),
    "등록된 사진이 아직 없습니다."
  );


  // ---------------------------------------------------
  // 이달
  // ---------------------------------------------------

  const monthItems =
    allMedia.filter(
      (item) => {

        const date =
          getTakenDate(
            item
          );


        if (!date) {
          return false;
        }


        const parts =
          getSeoulDateParts(
            date
          );


        return (
          parts.year ===
            nowParts.year &&
          parts.month ===
            nowParts.month
        );

      }
    );


  monthPageTitle.textContent =
    String(
      nowParts.year
    ) +
    "년 " +
    String(
      nowParts.month
    ) +
    "월의 하진";


  const dayGroups =
    groupBy(
      monthItems,
      getDayKey
    );


  renderGroups(
    monthGroups,
    dayGroups,
    formatDayTitle
  );


  // ---------------------------------------------------
  // 베스트
  // ---------------------------------------------------

  const bestItems =
    allMedia.filter(
      (item) =>
        item.favorite === true
    );


  renderGrid(
    bestGallery,
    bestItems,
    "아직 선택된 베스트샷이 없습니다."
  );


  // ---------------------------------------------------
  // 전체
  // ---------------------------------------------------

  const monthGroupsAll =
    groupBy(
      allMedia,
      getMonthKey
    );


  renderGroups(
    allGroups,
    monthGroupsAll,
    formatMonthTitle
  );

}


// =====================================================
// Firestore Settings
// =====================================================

async function loadSettings() {

  try {

    const snapshot =
      await getDoc(
        doc(
          db,
          "settings",
          "public"
        )
      );


    if (
      !snapshot.exists()
    ) {

      return;

    }


    const data =
      snapshot.data();


    if (
      data.siteTitle
    ) {

      document.title =
        data.siteTitle;


      const title =
        document.querySelector(
          ".site-title"
        );


      if (title) {

        title.textContent =
          data.siteTitle;

      }

    }

  }

  catch (error) {

    console.error(
      "설정 불러오기 실패",
      error
    );

  }

}


// =====================================================
// Firestore Media
// =====================================================

async function loadMedia() {

  const mediaQuery =
    query(

      collection(
        db,
        "media"
      ),

      where(
        "published",
        "==",
        true
      )

    );


  const snapshot =
    await getDocs(
      mediaQuery
    );


  const items = [];


  snapshot.forEach(
    (documentSnapshot) => {

      items.push({

        id:
          documentSnapshot.id,

        ...documentSnapshot.data()

      });

    }
  );


  items.sort(
    (a, b) =>
      getTakenMillis(b) -
      getTakenMillis(a)
  );


  allMedia =
    items;


  renderViews();

}


// =====================================================
// Start
// =====================================================

async function initialize() {

  try {

    await Promise.all([

      loadSettings(),

      loadMedia()

    ]);


    const hash =
      window.location.hash
        .replace(
          "#",
          ""
        );


    showPage(
      hash ||
      "home",
      false
    );

  }

  catch (error) {

    console.error(
      "초기화 실패",
      error
    );

  }

}


initialize();

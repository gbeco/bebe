import {
  db
} from "./firebase.js";


import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from
"https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";


const WORKER_BASE =
  "https://hajin-album-api.madocho.workers.dev";


// -----------------------------------------------------
// State
// -----------------------------------------------------

let mediaItems = [];

let currentViewerIndex =
  0;


// -----------------------------------------------------
// DOM
// -----------------------------------------------------

const gallery =
  document.getElementById(
    "gallery"
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


// -----------------------------------------------------
// Navigation
// -----------------------------------------------------

function setActiveNav(
  page
) {

  navItems.forEach(
    (item) => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    }
  );

}


function moveToPage(
  page
) {

  setActiveNav(
    page
  );


  let target = null;


  if (page === "home") {

    target =
      document.getElementById(
        "todaySection"
      );

  }


  if (page === "month") {

    target =
      document.getElementById(
        "monthSection"
      );

  }


  if (page === "best") {

    target =
      document.getElementById(
        "bestSection"
      );

  }


  if (page === "all") {

    target =
      document.getElementById(
        "gallerySection"
      );

  }


  if (target) {

    target.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }

}


pageButtons.forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        moveToPage(
          button.dataset.page
        );

      }
    );

  }
);


// -----------------------------------------------------
// 관리자 페이지
// -----------------------------------------------------

adminButton.addEventListener(
  "click",
  () => {

    window.location.href =
      WORKER_BASE +
      "/auth/test-page";

  }
);


// -----------------------------------------------------
// 날짜
// -----------------------------------------------------

function getTakenMillis(
  data
) {

  if (
    data.takenAt &&
    typeof data.takenAt.toMillis ===
      "function"
  ) {

    return data.takenAt.toMillis();

  }


  return 0;

}


function formatTakenDate(
  data
) {

  if (
    !data.takenAt ||
    typeof data.takenAt.toDate !==
      "function"
  ) {

    return "";

  }


  return data.takenAt
    .toDate()
    .toLocaleDateString(
      "ko-KR",
      {
        year:
          "numeric",

        month:
          "long",

        day:
          "numeric"
      }
    );

}


// -----------------------------------------------------
// Media URL
// -----------------------------------------------------

function getMediaUrl(
  data
) {

  return (
    WORKER_BASE +
    "/media/" +
    encodeURIComponent(
      data.driveFileId
    )
  );

}


// -----------------------------------------------------
// Viewer
// -----------------------------------------------------

function renderViewer() {

  if (
    mediaItems.length === 0
  ) {

    return;

  }


  const data =
    mediaItems[
      currentViewerIndex
    ];


  viewerContent.innerHTML =
    "";


  const mediaUrl =
    getMediaUrl(
      data
    );


  // ---------------------------------------------
  // 영상
  // ---------------------------------------------

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


    video.autoplay =
      false;


    video.playsInline =
      true;


    video.preload =
      "metadata";


    viewerContent.appendChild(
      video
    );

  }


  // ---------------------------------------------
  // 사진
  // ---------------------------------------------

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
      currentViewerIndex + 1
    ) +
    " / " +
    String(
      mediaItems.length
    );


  viewerDate.textContent =
    formatTakenDate(
      data
    );


  viewerName.textContent =
    data.name || "";


  // 하나밖에 없으면 화살표 숨김

  const showArrows =
    mediaItems.length > 1;


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
  index
) {

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


  // 영상이 재생 중일 수 있으므로 제거

  viewerContent.innerHTML =
    "";

}


function showPrevious() {

  if (
    mediaItems.length === 0
  ) {

    return;

  }


  currentViewerIndex =
    (
      currentViewerIndex -
      1 +
      mediaItems.length
    ) %
    mediaItems.length;


  renderViewer();

}


function showNext() {

  if (
    mediaItems.length === 0
  ) {

    return;

  }


  currentViewerIndex =
    (
      currentViewerIndex +
      1
    ) %
    mediaItems.length;


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


// 검은 배경 클릭 시 닫기

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


// 키보드

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
      event.touches.length !== 1
    ) {
      return;
    }


    touchStartX =
      event.touches[0].clientX;


    touchStartY =
      event.touches[0].clientY;

  },
  {
    passive: true
  }
);


mediaViewer.addEventListener(
  "touchend",
  (event) => {

    if (
      event.changedTouches.length !== 1
    ) {
      return;
    }


    const touchEndX =
      event.changedTouches[0].clientX;


    const touchEndY =
      event.changedTouches[0].clientY;


    const diffX =
      touchEndX -
      touchStartX;


    const diffY =
      touchEndY -
      touchStartY;


    // 세로 스크롤보다
    // 가로 움직임이 큰 경우만 처리
    if (
      Math.abs(diffX) <=
      Math.abs(diffY)
    ) {
      return;
    }


    // 최소 50px 이상 움직여야 스와이프로 판단
    if (
      Math.abs(diffX) < 50
    ) {
      return;
    }


    // 왼쪽으로 밀기 → 다음
    if (
      diffX < 0
    ) {

      showNext();

    }


    // 오른쪽으로 밀기 → 이전
    else {

      showPrevious();

    }

  },
  {
    passive: true
  }
);


// -----------------------------------------------------
// Gallery Card
// -----------------------------------------------------

function createMediaCard(
  data,
  index
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "media-card";


  card.setAttribute(
    "role",
    "button"
  );


  card.setAttribute(
    "tabindex",
    "0"
  );


  const mediaUrl =
    getMediaUrl(
      data
    );


  // ---------------------------------------------
  // 영상
  // ---------------------------------------------

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


    video.playsInline =
      true;


    video.muted =
      true;


    card.appendChild(
      video
    );

  }


  // ---------------------------------------------
  // 사진
  // ---------------------------------------------

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


  // ---------------------------------------------
  // 클릭
  // ---------------------------------------------

  card.addEventListener(
    "click",
    () => {

      openViewer(
        index
      );

    }
  );


  // Enter 키로도 열기

  card.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" ||
        event.key === " "
      ) {

        event.preventDefault();

        openViewer(
          index
        );

      }

    }
  );


  return card;

}


// -----------------------------------------------------
// 기본 설정
// -----------------------------------------------------

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


    if (!snapshot.exists()) {

      return;

    }


    const data =
      snapshot.data();


    if (data.siteTitle) {

      document.title =
        data.siteTitle;


      const siteTitle =
        document.querySelector(
          ".site-title"
        );


      if (siteTitle) {

        siteTitle.textContent =
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


// -----------------------------------------------------
// 최근 사진
// -----------------------------------------------------

async function loadRecentMedia() {

  try {

    gallery.innerHTML =
      '<div class="gallery-loading">사진을 불러오는 중...</div>';


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


    // 최신 촬영순

    items.sort(
      (a, b) =>
        getTakenMillis(b) -
        getTakenMillis(a)
    );


    // 현재 메인에서는 최근 12개

    mediaItems =
      items.slice(
        0,
        12
      );


    gallery.innerHTML =
      "";


    if (
      mediaItems.length === 0
    ) {

      gallery.innerHTML =
        '<div class="gallery-loading">아직 등록된 사진이 없습니다.</div>';

      return;

    }


    mediaItems.forEach(
      (item, index) => {

        gallery.appendChild(
          createMediaCard(
            item,
            index
          )
        );

      }
    );

  }

  catch (error) {

    console.error(
      "갤러리 오류",
      error
    );


    gallery.innerHTML =
      '<div class="gallery-loading">사진을 불러오지 못했습니다.</div>';

  }

}


// -----------------------------------------------------
// Start
// -----------------------------------------------------

async function initialize() {

  await Promise.all([

    loadSettings(),

    loadRecentMedia()

  ]);

}


initialize();

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
// 사진 카드
// -----------------------------------------------------

function createMediaCard(
  data
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "media-card";


  const mediaUrl =
    WORKER_BASE +
    "/media/" +
    encodeURIComponent(
      data.driveFileId
    );


  // 영상
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


    video.controls =
      true;


    card.appendChild(
      video
    );

  }


  // 사진
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


    // 촬영일 최신순
    items.sort(
      (a, b) =>
        getTakenMillis(b) -
        getTakenMillis(a)
    );


    // 메인 화면에서는 최근 12개
    const recentItems =
      items.slice(
        0,
        12
      );


    gallery.innerHTML =
      "";


    if (
      recentItems.length === 0
    ) {

      gallery.innerHTML =
        '<div class="gallery-loading">아직 등록된 사진이 없습니다.</div>';

      return;

    }


    recentItems.forEach(
      (item) => {

        gallery.appendChild(
          createMediaCard(
            item
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
// 시작
// -----------------------------------------------------

async function initialize() {

  await Promise.all([
    loadSettings(),
    loadRecentMedia()
  ]);

}


initialize();

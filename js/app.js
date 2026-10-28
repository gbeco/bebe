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
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
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

let hiddenMedia = [];

let allSearchText =
  "";

let activeAiTag =
  "";

let aiQueueInProgress =
  false;

let currentViewerItems = [];

let currentViewerIndex = 0;

let isAdmin = false;

let currentUser = null;

let selectedUploadFiles = [];

let isUploading =
  false;


const googleProvider =
  new GoogleAuthProvider();


// =====================================================
// DOM
// =====================================================

const aiAnalyzeButton =
  document.getElementById(
    "aiAnalyzeButton"
  );


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

const todayAiPick =
  document.getElementById(
    "todayAiPick"
  );


const todayAiPickImage =
  document.getElementById(
    "todayAiPickImage"
  );


const todayAiPickScore =
  document.getElementById(
    "todayAiPickScore"
  );


const todayAiPickCaption =
  document.getElementById(
    "todayAiPickCaption"
  );


const todayAiPickReason =
  document.getElementById(
    "todayAiPickReason"
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

const monthAiSection =
  document.getElementById(
    "monthAiSection"
  );


const monthAiGallery =
  document.getElementById(
    "monthAiGallery"
  );

const bestGallery =
  document.getElementById(
    "bestGallery"
  );

const aiBestGallery =
  document.getElementById(
    "aiBestGallery"
  );

const allSearchInput =
  document.getElementById(
    "allSearchInput"
  );


const allSearchClear =
  document.getElementById(
    "allSearchClear"
  );


const allTagFilters =
  document.getElementById(
    "allTagFilters"
  );


const allSearchCount =
  document.getElementById(
    "allSearchCount"
  );

const allGroups =
  document.getElementById(
    "allGroups"
  );

const uploadModal =
  document.getElementById(
    "uploadModal"
  );


const uploadCloseButton =
  document.getElementById(
    "uploadCloseButton"
  );


const uploadFileInput =
  document.getElementById(
    "uploadFileInput"
  );


const uploadFileList =
  document.getElementById(
    "uploadFileList"
  );


const uploadSummary =
  document.getElementById(
    "uploadSummary"
  );


const uploadStartButton =
  document.getElementById(
    "uploadStartButton"
  );

const hiddenMediaSection =
  document.getElementById(
    "hiddenMediaSection"
  );


const hiddenMediaList =
  document.getElementById(
    "hiddenMediaList"
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

const viewerCaption =
  document.getElementById(
    "viewerCaption"
  );


const viewerTags =
  document.getElementById(
    "viewerTags"
  );


const viewerAdminAi =
  document.getElementById(
    "viewerAdminAi"
  );


const viewerAiBestScore =
  document.getElementById(
    "viewerAiBestScore"
  );


const viewerAiScores =
  document.getElementById(
    "viewerAiScores"
  );


const viewerAiReason =
  document.getElementById(
    "viewerAiReason"
  );

const viewerName =
  document.getElementById(
    "viewerName"
  );


async function analyzeMediaItem(
  item
) {

  if (
    !isAdmin ||
    !currentUser
  ) {

    throw new Error(
      "관리자 로그인이 필요합니다."
    );

  }


  const idToken =
    await currentUser
      .getIdToken();


  const response =
    await fetch(
      WORKER_BASE +
      "/admin/ai/analyze",
      {

        method:
          "POST",

        headers: {

          Authorization:
            "Bearer " +
            idToken,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            mediaId:
              item.id

          })

      }
    );


  let result;


  try {

    result =
      await response.json();

  }

  catch {

    throw new Error(
      "AI 서버 응답을 읽지 못했습니다."
    );

  }


  if (!response.ok) {

    throw new Error(
      result.error ||
      "AI 분석에 실패했습니다."
    );

  }


  return result;

}

async function analyzeMediaWithRetry(
  item
) {

  const maxAttempts =
    3;


  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {

    try {

      return await analyzeMediaItem(
        item
      );

    }

    catch (error) {

      const message =
        String(
          error.message || ""
        ).toLowerCase();


      const retryable =
        message.includes(
          "too many concurrent"
        ) ||
        message.includes(
          "rate"
        ) ||
        message.includes(
          "429"
        );


      if (
        !retryable ||
        attempt === maxAttempts
      ) {

        throw error;

      }


      console.log(
        "AI 재시도 대기",
        item.id,
        attempt
      );


      // 1차 실패 → 5초
      // 2차 실패 → 10초
      await wait(
        attempt *
        5000
      );

    }

  }

}

async function processPendingAiQueue(
  showMessage = false
) {

  // 이미 다른 AI 작업이 실행 중
  if (
    aiQueueInProgress
  ) {

    console.log(
      "AI 대기열이 이미 실행 중입니다."
    );


    if (showMessage) {

      alert(
        "AI 분석이 이미 진행 중입니다."
      );

    }


    return;

  }


  if (
    !isAdmin ||
    !currentUser
  ) {

    if (showMessage) {

      alert(
        "관리자 로그인이 필요합니다."
      );

    }


    return;

  }


  aiQueueInProgress =
    true;


  if (aiAnalyzeButton) {

    aiAnalyzeButton.disabled =
      true;


    aiAnalyzeButton.textContent =
      "확인 중";

  }


  try {

    // =============================================
    // Firestore에서 pending을 직접 다시 조회
    // =============================================

    const pendingQuery =
      query(

        collection(
          db,
          "media"
        ),

        where(
          "ai.status",
          "==",
          "pending"
        )

      );


    const snapshot =
      await getDocs(
        pendingQuery
      );


    const pendingItems =
      [];


    const skippedItems =
      [];
    
    
    snapshot.forEach(
      (documentSnapshot) => {
    
        const item = {
    
          id:
            documentSnapshot.id,
    
          ...documentSnapshot.data()
    
        };
    
    
        console.log(
          "pending 문서 확인:",
          {
            id:
              item.id,
    
            name:
              item.name,
    
            mediaType:
              item.mediaType,
    
            thumbnailDriveFileId:
              item.thumbnailDriveFileId,
    
            aiStatus:
              item.ai?.status
          }
        );
    
    
        if (
          item.mediaType !==
            "photo"
        ) {
    
          skippedItems.push({
            item,
            reason:
              "mediaType이 photo가 아님"
          });
    
    
          return;
    
        }
    
    
        if (
          !item.thumbnailDriveFileId
        ) {
    
          skippedItems.push({
            item,
            reason:
              "thumbnailDriveFileId 없음"
          });
    
    
          return;
    
        }
    
    
        pendingItems.push(
          item
        );
    
      }
    );


    console.log(
      "Firestore pending 조회 결과:",
      {
        total:
          snapshot.size,
    
        analyzable:
          pendingItems.length,
    
        skipped:
          skippedItems.map(
            (entry) => ({
              id:
                entry.item.id,
    
              name:
                entry.item.name,
    
              reason:
                entry.reason
            })
          )
      }
    );


    // =============================================
    // pending 없음
    // =============================================

    if (
      pendingItems.length === 0
    ) {
    
      if (
        snapshot.size > 0
      ) {
    
        const reasons =
          skippedItems
            .map(
              (entry) =>
                (entry.item.name ||
                  entry.item.id) +
                "\n→ " +
                entry.reason
            )
            .join(
              "\n\n"
            );
    
    
        console.warn(
          "pending 문서는 있지만 분석 조건에서 제외됨",
          skippedItems
        );
    
    
        if (showMessage) {
    
          alert(
            "pending 사진은 " +
            snapshot.size +
            "장 있지만 AI 분석 조건에서 제외되었습니다.\n\n" +
            reasons
          );
    
        }
    
      }
    
      else {
    
        if (showMessage) {
    
          alert(
            "Firestore에 ai.status = pending인 사진이 없습니다."
          );
    
        }
    
      }
    
    
      return;
    
    }


    console.log(
      "AI 자동 분석 시작:",
      pendingItems.length
    );


    let successCount =
      0;


    let failureCount =
      0;


    // =============================================
    // 반드시 한 장씩 순차 분석
    // =============================================

    for (
      let index = 0;
      index < pendingItems.length;
      index += 1
    ) {

      const item =
        pendingItems[index];


      console.log(
        "AI 분석 중:",
        index + 1,
        "/",
        pendingItems.length,
        item.id
      );


      if (aiAnalyzeButton) {

        aiAnalyzeButton.textContent =
          "AI " +
          (index + 1) +
          "/" +
          pendingItems.length;

      }


      try {

        const result =
          await analyzeMediaWithRetry(
            item
          );


        successCount++;


        console.log(
          "AI 분석 완료:",
          item.id,
          result.analysis?.caption
        );

      }

      catch (error) {

        failureCount++;


        console.error(
          "사진 AI 분석 실패:",
          item.id,
          error
        );

      }


      // Ollama Free:
      // 다음 요청과 간격을 둠
      if (
        index <
        pendingItems.length - 1
      ) {

        await wait(
          3000
        );

      }

    }


    console.log(
      "AI 자동 분석 종료",
      {
        successCount,
        failureCount
      }
    );


    if (showMessage) {

      alert(
        "AI 분석 완료\n\n" +
        "성공: " +
        successCount +
        "장\n" +
        "실패: " +
        failureCount +
        "장"
      );

    }

  }

  catch (error) {

    console.error(
      "AI 대기열 실행 오류",
      error
    );


    if (showMessage) {

      alert(
        "AI 분석 대기열 실행에 실패했습니다.\n\n" +
        error.message
      );

    }

  }

  finally {

    aiQueueInProgress =
      false;


    if (aiAnalyzeButton) {

      aiAnalyzeButton.disabled =
        false;


      aiAnalyzeButton.textContent =
        "AI";

    }


    // 최종 상태 다시 읽기
    await loadMedia();

  }

}

// =====================================================
// Ollama AI Test
// 중복 실행 방지
// =====================================================

aiAnalyzeButton.onclick =
  async () => {

    await processPendingAiQueue(
      true
    );

  };

function wait(
  milliseconds
) {

  return new Promise(
    (resolve) => {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );

}

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

function getSeoulDayNumber(
  date
) {

  const parts =
    getSeoulDateParts(
      date
    );


  return Math.floor(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day
    ) /
    86400000
  );

}


function isWithinRecentDays(
  item,
  days = 7
) {

  const date =
    getTakenDate(
      item
    );


  if (!date) {

    return false;

  }


  const todayNumber =
    getSeoulDayNumber(
      new Date()
    );


  const itemNumber =
    getSeoulDayNumber(
      date
    );


  const difference =
    todayNumber -
    itemNumber;


  return (
    difference >= 0 &&
    difference < days
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

    aiAnalyzeButton.hidden =
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

    aiAnalyzeButton.hidden =
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

uploadButton.addEventListener(
  "click",
  () => {

    if (!isAdmin) {
      return;
    }


    openUploadModal();

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
      await loadMedia();
      
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

      await loadMedia();
      await processPendingAiQueue();
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

function renderViewerAiInfo(
  data
) {

  const ai =
    data.ai;


  // =============================================
  // 초기화
  // =============================================

  viewerCaption.textContent =
    "";


  viewerCaption.hidden =
    true;


  viewerTags.innerHTML =
    "";


  viewerTags.hidden =
    true;


  viewerAdminAi.hidden =
    true;


  viewerAiBestScore.textContent =
    "";


  viewerAiScores.textContent =
    "";


  viewerAiReason.textContent =
    "";


  // =============================================
  // AI 분석 완료 사진만 표시
  // =============================================

  if (
    data.mediaType !==
      "photo" ||
    !ai ||
    ai.status !==
      "done"
  ) {

    return;

  }


  // =============================================
  // 일반 사용자에게도 보이는 AI 설명
  // =============================================

  if (
    ai.caption
  ) {

    viewerCaption.textContent =
      ai.caption;


    viewerCaption.hidden =
      false;

  }


  // =============================================
  // 태그
  // =============================================

  const tags =
    Array.isArray(
      ai.tags
    )
      ? ai.tags
      : [];


  if (
    tags.length > 0
  ) {

    tags.forEach(
      (tag) => {

        const tagElement =
          document.createElement(
            "span"
          );


        tagElement.className =
          "viewer-tag";


        tagElement.textContent =
          "#" +
          String(
            tag
          );


        viewerTags.appendChild(
          tagElement
        );

      }
    );


    viewerTags.hidden =
      false;

  }


  // =============================================
  // 관리자 전용 AI 정보
  // =============================================

  if (
    !isAdmin ||
    !currentUser
  ) {

    return;

  }


  viewerAdminAi.hidden =
    false;


  const bestScore =
    Math.round(
      Number(
        ai.bestShotScore ||
        0
      )
    );


  const momentScore =
    Math.round(
      Number(
        ai.momentScore ||
        0
      )
    );


  const qualityScore =
    Math.round(
      Number(
        ai.qualityScore ||
        0
      )
    );


  viewerAiBestScore.textContent =
    "추천 " +
    bestScore +
    "점";


  viewerAiScores.textContent =
    "순간성 " +
    momentScore +
    " · 사진 품질 " +
    qualityScore;


  if (
    ai.bestShotReason
  ) {

    viewerAiReason.textContent =
      ai.bestShotReason;

  }

}

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

  renderViewerAiInfo(
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
// Upload Modal
// =====================================================

function openUploadModal() {

  selectedUploadFiles =
    [];


  uploadFileInput.value =
    "";


  uploadFileList.innerHTML =
    "";


  uploadSummary.textContent =
    "파일을 선택해주세요.";


  uploadStartButton.disabled =
    true;


  uploadModal.classList.add(
    "open"
  );


  uploadModal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.style.overflow =
    "hidden";

}


function closeUploadModal() {

  if (isUploading) {

    alert(
      "업로드가 진행 중입니다."
    );

    return;

  }


  uploadModal.classList.remove(
    "open"
  );


  uploadModal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.style.overflow =
    "";

}


// =====================================================
// Upload UI
// =====================================================

function renderUploadFiles() {

  uploadFileList.innerHTML =
    "";


  selectedUploadFiles.forEach(
    (item, index) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "upload-file-item";


      row.dataset.index =
        String(index);


      row.innerHTML =
        `
          <div class="upload-file-top">

            <div class="upload-file-name">
            </div>

            <div class="upload-file-status">
              준비
            </div>

          </div>

          <div class="upload-progress">

            <div
              class="upload-progress-bar"
            ></div>

          </div>
        `;


      row.querySelector(
        ".upload-file-name"
      ).textContent =
        item.file.name;


      uploadFileList.appendChild(
        row
      );

    }
  );


  uploadSummary.textContent =
    selectedUploadFiles.length +
    "개 파일 선택";


  uploadStartButton.textContent =
    selectedUploadFiles.length +
    "개 업로드";


  uploadStartButton.disabled =
    selectedUploadFiles.length ===
      0;

}


function updateUploadRow(
  index,
  status,
  progress,
  type = ""
) {

  const row =
    uploadFileList.querySelector(
      '[data-index="' +
      index +
      '"]'
    );


  if (!row) {
    return;
  }


  const statusElement =
    row.querySelector(
      ".upload-file-status"
    );


  const progressElement =
    row.querySelector(
      ".upload-progress-bar"
    );


  statusElement.textContent =
    status;


  statusElement.className =
    "upload-file-status";


  if (type) {

    statusElement.classList.add(
      type
    );

  }


  progressElement.style.width =
    Math.max(
      0,
      Math.min(
        100,
        progress
      )
    ) +
    "%";

}


// =====================================================
// File type
// =====================================================

function getUploadMediaType(
  file
) {

  if (
    file.type.startsWith(
      "image/"
    )
  ) {

    return "photo";

  }


  if (
    file.type.startsWith(
      "video/"
    )
  ) {

    return "video";

  }


  return null;

}


// =====================================================
// EXIF 촬영일
// =====================================================

async function getUploadTakenAt(
  file,
  mediaType
) {

  if (
    mediaType !==
      "photo"
  ) {

    return new Date(
      file.lastModified ||
      Date.now()
    );

  }


  try {

    if (window.exifr) {

      const metadata =
        await window.exifr.parse(
          file,
          [
            "DateTimeOriginal",
            "CreateDate",
            "ModifyDate"
          ]
        );


      if (
        metadata?.DateTimeOriginal
      ) {

        return new Date(
          metadata.DateTimeOriginal
        );

      }


      if (
        metadata?.CreateDate
      ) {

        return new Date(
          metadata.CreateDate
        );

      }


      if (
        metadata?.ModifyDate
      ) {

        return new Date(
          metadata.ModifyDate
        );

      }

    }

  }

  catch (error) {

    console.warn(
      "EXIF 읽기 실패",
      error
    );

  }


  return new Date(
    file.lastModified ||
    Date.now()
  );

}


// =====================================================
// Thumbnail
// =====================================================

function createUploadThumbnail(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const image =
        new Image();


      const objectUrl =
        URL.createObjectURL(
          file
        );


      image.onload =
        () => {

          try {

            const maxSize =
              1200;


            let width =
              image.naturalWidth;


            let height =
              image.naturalHeight;


            if (
              width > maxSize ||
              height > maxSize
            ) {

              const ratio =
                Math.min(
                  maxSize / width,
                  maxSize / height
                );


              width =
                Math.round(
                  width * ratio
                );


              height =
                Math.round(
                  height * ratio
                );

            }


            const canvas =
              document.createElement(
                "canvas"
              );


            canvas.width =
              width;


            canvas.height =
              height;


            const context =
              canvas.getContext(
                "2d"
              );


            context.drawImage(
              image,
              0,
              0,
              width,
              height
            );


            canvas.toBlob(
              (blob) => {

                URL.revokeObjectURL(
                  objectUrl
                );


                if (!blob) {

                  reject(
                    new Error(
                      "썸네일 생성 실패"
                    )
                  );

                  return;

                }


                resolve(blob);

              },
              "image/jpeg",
              0.82
            );

          }

          catch (error) {

            URL.revokeObjectURL(
              objectUrl
            );


            reject(error);

          }

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            objectUrl
          );


          reject(
            new Error(
              "이미지를 읽을 수 없습니다."
            )
          );

        };


      image.src =
        objectUrl;

    }
  );

}


function createVideoThumbnail(
  file
) {

  return new Promise(
    (resolve, reject) => {

      const video =
        document.createElement(
          "video"
        );


      const objectUrl =
        URL.createObjectURL(
          file
        );


      let finished =
        false;


      function cleanup() {

        URL.revokeObjectURL(
          objectUrl
        );


        video.removeAttribute(
          "src"
        );


        video.load();

      }


      function fail(
        message
      ) {

        if (finished) {
          return;
        }


        finished =
          true;


        cleanup();


        reject(
          new Error(
            message
          )
        );

      }


      function captureFrame() {

        if (finished) {
          return;
        }


        try {

          const sourceWidth =
            video.videoWidth;


          const sourceHeight =
            video.videoHeight;


          if (
            !sourceWidth ||
            !sourceHeight
          ) {

            fail(
              "영상 크기를 확인할 수 없습니다."
            );

            return;

          }


          const maxSize =
            1200;


          let width =
            sourceWidth;


          let height =
            sourceHeight;


          if (
            width > maxSize ||
            height > maxSize
          ) {

            const ratio =
              Math.min(
                maxSize / width,
                maxSize / height
              );


            width =
              Math.round(
                width * ratio
              );


            height =
              Math.round(
                height * ratio
              );

          }


          const canvas =
            document.createElement(
              "canvas"
            );


          canvas.width =
            width;


          canvas.height =
            height;


          const context =
            canvas.getContext(
              "2d"
            );


          context.drawImage(
            video,
            0,
            0,
            width,
            height
          );


          canvas.toBlob(
            (blob) => {

              if (!blob) {

                fail(
                  "영상 썸네일 생성에 실패했습니다."
                );

                return;

              }


              finished =
                true;


              cleanup();


              resolve(
                blob
              );

            },
            "image/jpeg",
            0.82
          );

        }

        catch (error) {

          fail(
            error.message ||
            "영상 프레임을 캡처하지 못했습니다."
          );

        }

      }


      video.preload =
        "metadata";


      video.muted =
        true;


      video.playsInline =
        true;


      video.addEventListener(
        "loadedmetadata",
        () => {

          const duration =
            Number(
              video.duration
            );


          let seekTime =
            0;


          if (
            Number.isFinite(
              duration
            ) &&
            duration > 0.2
          ) {

            // 영상의 약 10% 지점.
            // 너무 뒤로 가지 않도록 최대 1.5초.
            seekTime =
              Math.min(
                duration * 0.1,
                1.5
              );

          }


          try {

            video.currentTime =
              seekTime;

          }

          catch {

            fail(
              "영상 위치를 이동할 수 없습니다."
            );

          }

        },
        {
          once: true
        }
      );


      video.addEventListener(
        "seeked",
        () => {

          // 최신 브라우저에서는 실제 프레임이
          // 준비된 뒤 캡처
          if (
            typeof video.requestVideoFrameCallback ===
              "function"
          ) {

            video.requestVideoFrameCallback(
              () => {

                captureFrame();

              }
            );

          }

          else {

            // 구형 브라우저 fallback
            setTimeout(
              captureFrame,
              80
            );

          }

        },
        {
          once: true
        }
      );


      video.addEventListener(
        "error",
        () => {

          fail(
            "브라우저에서 이 영상을 읽을 수 없습니다."
          );

        },
        {
          once: true
        }
      );


      video.src =
        objectUrl;

    }
  );

}


// =====================================================
// Worker upload session
// =====================================================

async function createUploadSession(
  file,
  mediaType,
  idToken
) {

  const response =
    await fetch(
      WORKER_BASE +
      "/upload/start",
      {

        method:
          "POST",

        headers: {

          Authorization:
            "Bearer " +
            idToken,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            fileName:
              file.name,

            mimeType:
              file.type ||
              "application/octet-stream",

            fileSize:
              file.size,

            mediaType:
              mediaType

          })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error ||
      "업로드 준비 실패"
    );

  }


  return data.uploadUrl;

}


// =====================================================
// 8 MiB Chunk Upload
// =====================================================

async function uploadFileInChunks(
  uploadUrl,
  file,
  idToken,
  onProgress
) {

  const chunkSize =
    8 *
    1024 *
    1024;


  let start =
    0;


  while (
    start <
    file.size
  ) {

    const endExclusive =
      Math.min(
        start +
        chunkSize,
        file.size
      );


    const end =
      endExclusive -
      1;


    const chunk =
      file.slice(
        start,
        endExclusive
      );


    const response =
      await fetch(
        WORKER_BASE +
        "/upload/chunk",
        {

          method:
            "POST",

          headers: {

            Authorization:
              "Bearer " +
              idToken,

            "Content-Type":
              "application/octet-stream",

            "X-Drive-Upload-Url":
              uploadUrl,

            "X-Upload-Start":
              String(start),

            "X-Upload-End":
              String(end),

            "X-Upload-Total":
              String(
                file.size
              ),

            "X-File-Type":
              file.type ||
              "application/octet-stream"

          },

          body:
            chunk

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "파일 업로드 실패"
      );

    }


    const uploaded =
      endExclusive;


    if (onProgress) {

      onProgress(
        Math.round(
          (
            uploaded /
            file.size
          ) *
          100
        )
      );

    }


    if (
      data.complete === true
    ) {

      return data.driveFile;

    }


    start =
      endExclusive;

  }


  throw new Error(
    "업로드 완료 응답을 받지 못했습니다."
  );

}


// =====================================================
// Thumbnail upload
// =====================================================

async function uploadThumbnailFile(
  originalDriveFile,
  originalFile,
  mediaType,
  idToken
) {

  let blob;


  if (
    mediaType === "video"
  ) {

    blob =
      await createVideoThumbnail(
        originalFile
      );

  }

  else {

    blob =
      await createUploadThumbnail(
        originalFile
      );

  }


  const thumbnail =
    new File(
      [blob],
      originalDriveFile.id +
        ".jpg",
      {
        type:
          "image/jpeg"
      }
    );


  const uploadUrl =
    await createUploadSession(
      thumbnail,
      "thumbnail",
      idToken
    );


  return await uploadFileInChunks(
    uploadUrl,
    thumbnail,
    idToken
  );

}


// =====================================================
// Firestore 등록
// =====================================================

async function registerUploadedMedia(
  driveFile,
  file,
  mediaType,
  thumbnailDriveFileId
) {

  const takenAt =
    await getUploadTakenAt(
      file,
      mediaType
    );

  let aiStatus =
    "not_applicable";
  
  
  if (
    mediaType === "photo"
  ) {
  
    aiStatus =
      thumbnailDriveFileId
        ? "pending"
        : "thumbnail_missing";
  
  }


  await setDoc(
    doc(
      db,
      "media",
      driveFile.id
    ),
    {

      driveFileId:
        driveFile.id,

      thumbnailDriveFileId:
        thumbnailDriveFileId ||
        null,

      name:
        driveFile.name ||
        file.name,

      mimeType:
        driveFile.mimeType ||
        file.type ||
        "application/octet-stream",

      mediaType:
        mediaType,

      size:
        Number(
          driveFile.size ||
          file.size ||
          0
        ),

      takenAt:
        takenAt,

      uploadedAt:
        serverTimestamp(),

      published:
        true,

      favorite:
        false,

      ai: {
        status:
          aiStatus
      }

    }
  );

}


// =====================================================
// Single File Upload
// =====================================================

async function uploadOneFile(
  item,
  index,
  idToken
) {

  const file =
    item.file;


  const mediaType =
    getUploadMediaType(
      file
    );


  if (!mediaType) {

    throw new Error(
      "지원하지 않는 파일 형식입니다."
    );

  }


  updateUploadRow(
    index,
    "원본 준비",
    2
  );


  const uploadUrl =
    await createUploadSession(
      file,
      mediaType,
      idToken
    );


  updateUploadRow(
    index,
    "원본 업로드",
    5
  );


  const driveFile =
    await uploadFileInChunks(
      uploadUrl,
      file,
      idToken,
      (percent) => {

        updateUploadRow(
          index,
          "원본 " +
            percent +
            "%",
          Math.round(
            5 +
            percent *
            0.75
          )
        );

      }
    );


  let thumbnailDriveFileId =
    null;


  if (
    mediaType === "photo" ||
    mediaType === "video"
  ) {

    updateUploadRow(
      index,
      mediaType === "video"
        ? "영상 썸네일 생성"
        : "사진 썸네일 생성"
      82
    );


    try {

      const thumbnailDriveFile =
        await uploadThumbnailFile(
          driveFile,
          file,
          mediaType,
          idToken
        );


      thumbnailDriveFileId =
        thumbnailDriveFile.id;

    }

    catch (error) {

      console.error(
        "썸네일 생성/업로드 실패",
        {
          fileName:
            file.name,
    
          fileType:
            file.type,
    
          fileSize:
            file.size,
    
          error:
            error
        }
      );
    
    
      alert(
        "썸네일 생성에 실패했습니다.\n\n" +
        "파일: " +
        file.name +
        "\n" +
        "형식: " +
        (file.type || "알 수 없음") +
        "\n\n" +
        "오류: " +
        (
          error.message ||
          String(error)
        )
      );
    
    }

  }


  updateUploadRow(
    index,
    "사진첩 등록",
    95
  );


  await registerUploadedMedia(
    driveFile,
    file,
    mediaType,
    thumbnailDriveFileId
  );


  updateUploadRow(
    index,
    "완료",
    100,
    "success"
  );

}

uploadFileInput.addEventListener(
  "change",
  () => {

    const files =
      Array.from(
        uploadFileInput.files ||
        []
      );


    selectedUploadFiles =
      files
        .filter(
          (file) =>
            file.type.startsWith(
              "image/"
            ) ||
            file.type.startsWith(
              "video/"
            )
        )
        .map(
          (file) => ({
            file
          })
        );


    renderUploadFiles();

  }
);


uploadCloseButton.addEventListener(
  "click",
  closeUploadModal
);


uploadModal.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
        uploadModal
    ) {

      closeUploadModal();

    }

  }
);

uploadStartButton.addEventListener(
  "click",
  async () => {

    if (
      !isAdmin ||
      !currentUser ||
      selectedUploadFiles.length ===
        0 ||
      isUploading
    ) {

      return;

    }


    isUploading =
      true;


    uploadStartButton.disabled =
      true;


    uploadCloseButton.disabled =
      true;


    try {

      const idToken =
        await currentUser
          .getIdToken();


      let successCount =
        0;


      let failureCount =
        0;


      for (
        let index = 0;
        index <
        selectedUploadFiles.length;
        index++
      ) {

        uploadSummary.textContent =
          String(
            index + 1
          ) +
          " / " +
          String(
            selectedUploadFiles.length
          ) +
          " 업로드 중";


        try {

          await uploadOneFile(
            selectedUploadFiles[
              index
            ],
            index,
            idToken
          );


          successCount++;

        }

        catch (error) {

          console.error(
            "파일 업로드 실패",
            error
          );


          failureCount++;


          updateUploadRow(
            index,
            "실패",
            100,
            "error"
          );

        }

      }


      uploadSummary.textContent =
        "완료 " +
        successCount +
        "개" +
        (
          failureCount > 0
            ? " · 실패 " +
              failureCount +
              "개"
            : ""
        );


      // Firestore 다시 읽어서
      // 갤러리 즉시 갱신
      await loadMedia();
      await processPendingAiQueue();

      uploadStartButton.textContent =
        "업로드 완료";

    }

    catch (error) {

      console.error(
        "업로드 오류",
        error
      );


      uploadSummary.textContent =
        "업로드 중 오류가 발생했습니다.";

    }

    finally {

      isUploading =
        false;


      uploadCloseButton.disabled =
        false;

    }

  }
);

// =====================================================
// Permanent Delete
// =====================================================

async function deleteMediaPermanently(
  item
) {

  if (
    !isAdmin ||
    !currentUser
  ) {

    return;

  }


  if (
    item.published === true
  ) {

    alert(
      "먼저 비공개로 변경한 뒤 삭제해주세요."
    );

    return;

  }


  const confirmed =
    window.confirm(
      "이 사진을 완전히 삭제할까요?\n\n" +
      "Google Drive의 원본과 썸네일까지 삭제되며 복구할 수 없습니다."
    );


  if (!confirmed) {

    return;

  }


  try {

    const idToken =
      await currentUser
        .getIdToken();


    const response =
      await fetch(
        WORKER_BASE +
        "/admin/media/delete",
        {

          method:
            "POST",

          headers: {

            Authorization:
              "Bearer " +
              idToken,

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              driveFileId:
                item.driveFileId,

              thumbnailDriveFileId:
                item.thumbnailDriveFileId ||
                null

            })

        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Drive 삭제 실패"
      );

    }


    // Drive 삭제 성공 후 Firestore 제거
    await deleteDoc(
      doc(
        db,
        "media",
        item.id
      )
    );


    await loadMedia();

  }

  catch (error) {

    console.error(
      "완전 삭제 실패",
      error
    );


    alert(
      "완전 삭제에 실패했습니다.\n" +
      error.message
    );

  }

}

// =====================================================
// Published
// =====================================================

async function setPublished(
  item,
  published
) {

  if (
    !isAdmin ||
    !currentUser
  ) {

    return;

  }


  try {

    await updateDoc(
      doc(
        db,
        "media",
        item.id
      ),
      {
        published:
          published
      }
    );


    await loadMedia();

  }

  catch (error) {

    console.error(
      "공개 상태 변경 실패",
      error
    );


    alert(
      "공개 상태를 변경하지 못했습니다."
    );

  }

}


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
  
    // =============================================
    // 새 영상: 생성된 JPEG 썸네일 사용
    // =============================================
  
    if (
      data.thumbnailDriveFileId
    ) {
  
      const image =
        document.createElement(
          "img"
        );
  
  
      image.className =
        "gallery-media";
  
  
      image.src =
        getThumbnailUrl(
          data
        );
  
  
      image.alt =
        data.name ||
        "영상";
  
  
      image.loading =
        "lazy";
  
  
      image.decoding =
        "async";
  
  
      card.appendChild(
        image
      );
  
    }
  
    // =============================================
    // 예전 영상처럼 썸네일이 없는 경우
    // 원본 영상으로 fallback
    // =============================================
  
    else {
  
      const video =
        document.createElement(
          "video"
        );
  
  
      video.className =
        "gallery-media";
  
  
      video.src =
        getMediaUrl(
          data
        );
  
  
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
  
  
    // =============================================
    // 영상 표시
    // =============================================
  
    const playBadge =
      document.createElement(
        "span"
      );
  
  
    playBadge.className =
      "video-play-badge";
  
  
    playBadge.textContent =
      "▶";
  
  
    playBadge.setAttribute(
      "aria-hidden",
      "true"
    );
  
  
    card.appendChild(
      playBadge
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
  
  // ---------------------------------------------
  // 관리자 공개 / 비공개 버튼
  // ---------------------------------------------

  if (
    isAdmin &&
    data.published === true
  ) {

    const visibilityButton =
      document.createElement(
        "button"
      );


    visibilityButton.type =
      "button";


    visibilityButton.className =
      "visibility-button";


    visibilityButton.textContent =
      "◉";


    visibilityButton.title =
      "비공개로 변경";


    visibilityButton.setAttribute(
      "aria-label",
      "비공개로 변경"
    );


    visibilityButton.addEventListener(
      "click",
      async (event) => {

        event.stopPropagation();


        const confirmed =
          window.confirm(
            "이 사진을 가족 사진첩에서 숨길까요?"
          );


        if (!confirmed) {

          return;

        }


        visibilityButton.disabled =
          true;


        await setPublished(
          data,
          false
        );

      }
    );


    card.appendChild(
      visibilityButton
    );

  }


  // ---------------------------------------------
  // 촬영일 정보
  // ---------------------------------------------

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
  // 카드 클릭 → 전체화면
  // ---------------------------------------------

  card.addEventListener(
    "click",
    () => {

      openViewer(
        items,
        index
      );

    }
  );


  // 키보드 접근
  card.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter" ||
        event.key === " "
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

// =====================================================
// Gallery Grid
// =====================================================

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
// Hidden Media
// =====================================================

function renderHiddenMedia() {

  if (
    !isAdmin ||
    hiddenMedia.length === 0
  ) {

    hiddenMediaSection.hidden =
      true;


    hiddenMediaList.innerHTML =
      "";


    return;

  }


  hiddenMediaSection.hidden =
    false;


  hiddenMediaList.innerHTML =
    "";


  hiddenMedia.forEach(
    (item) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "hidden-media-item";


      const info =
        document.createElement(
          "div"
        );


      info.className =
        "hidden-media-info";


      const name =
        document.createElement(
          "div"
        );


      name.className =
        "hidden-media-name";


      name.textContent =
        item.name ||
        "이름 없는 파일";


      const date =
        document.createElement(
          "div"
        );


      date.className =
        "hidden-media-date";


      date.textContent =
        formatTakenDate(
          item
        );


      info.appendChild(
        name
      );


      info.appendChild(
        date
      );


      const restoreButton =
        document.createElement(
          "button"
        );


      restoreButton.type =
        "button";


      restoreButton.className =
        "restore-button";


      restoreButton.textContent =
        "다시 공개";


      restoreButton.addEventListener(
        "click",
        async () => {

          restoreButton.disabled =
            true;


          await setPublished(
            item,
            true
          );

        }
      );


      hiddenMediaList.appendChild(
        row
      );

      const deleteButton =
        document.createElement(
          "button"
        );
      
      
      deleteButton.type =
        "button";
      
      
      deleteButton.className =
        "delete-media-button";
      
      
      deleteButton.textContent =
        "완전 삭제";
      
      
      deleteButton.addEventListener(
        "click",
        async () => {
      
          deleteButton.disabled =
            true;
      
      
          await deleteMediaPermanently(
            item
          );
      
      
          deleteButton.disabled =
            false;
      
        }
      );

      row.appendChild(
        info
      );
      
      
      const actions =
        document.createElement(
          "div"
        );
      
      
      actions.className =
        "hidden-media-actions";
      
      
      actions.appendChild(
        restoreButton
      );
      
      
      actions.appendChild(
        deleteButton
      );
      
      
      row.appendChild(
        actions
      );

    }
  );

}

// =====================================================
// Album Search
// =====================================================

function normalizeAlbumSearch(
  value
) {

  return String(
    value || ""
  )
    .normalize(
      "NFKC"
    )
    .toLowerCase()
    .trim();

}

function getAlbumSearchText(
  item
) {

  const ai =
    item.ai || {};


  const tags =
    Array.isArray(
      ai.tags
    )
      ? ai.tags
      : [];


  const mediaLabel =
    item.mediaType ===
      "video"
      ? "영상 비디오"
      : "사진 포토";


  return normalizeAlbumSearch(
    [

      item.name || "",

      ai.caption || "",

      ai.scene || "",

      ai.expression || "",

      ...tags,

      mediaLabel

    ].join(
      " "
    )
  );

}

function getPopularAiTags(
  items,
  limit = 10
) {

  const counts =
    new Map();


  items.forEach(
    (item) => {

      const tags =
        Array.isArray(
          item.ai?.tags
        )
          ? item.ai.tags
          : [];


      tags.forEach(
        (tag) => {

          const displayTag =
            String(
              tag || ""
            ).trim();


          if (!displayTag) {

            return;

          }


          const key =
            normalizeAlbumSearch(
              displayTag
            );


          const existing =
            counts.get(
              key
            );


          if (existing) {

            existing.count +=
              1;

          }

          else {

            counts.set(
              key,
              {

                tag:
                  displayTag,

                count:
                  1

              }
            );

          }

        }
      );

    }
  );


  return Array.from(
    counts.values()
  )
    .sort(
      (a, b) =>
        b.count -
        a.count
    )
    .slice(
      0,
      limit
    );

}

function renderAllTagFilters() {

  if (!allTagFilters) {

    return;

  }


  allTagFilters.innerHTML =
    "";


  const popularTags =
    getPopularAiTags(
      allMedia,
      10
    );


  // ---------------------------------------------
  // 전체 버튼
  // ---------------------------------------------

  const allButton =
    document.createElement(
      "button"
    );


  allButton.type =
    "button";


  allButton.className =
    "album-tag-button";


  allButton.dataset.tag =
    "";


  allButton.textContent =
    "전체";


  if (
    !activeAiTag
  ) {

    allButton.classList.add(
      "active"
    );

  }


  allTagFilters.appendChild(
    allButton
  );


  // ---------------------------------------------
  // AI 태그
  // ---------------------------------------------

  popularTags.forEach(
    (entry) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "album-tag-button";


      button.dataset.tag =
        entry.tag;


      button.textContent =
        "#" +
        entry.tag;


      if (
        normalizeAlbumSearch(
          activeAiTag
        ) ===
        normalizeAlbumSearch(
          entry.tag
        )
      ) {

        button.classList.add(
          "active"
        );

      }


      allTagFilters.appendChild(
        button
      );

    }
  );

}

function renderAllFilteredView() {

  const searchText =
    normalizeAlbumSearch(
      allSearchText
    );


  const searchTokens =
    searchText
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );


  const normalizedActiveTag =
    normalizeAlbumSearch(
      activeAiTag
    );


  const filteredItems =
    allMedia.filter(
      (item) => {

        // ---------------------------------------
        // 텍스트 검색
        // ---------------------------------------

        const searchableText =
          getAlbumSearchText(
            item
          );


        const matchesText =
          searchTokens.every(
            (token) =>
              searchableText.includes(
                token
              )
          );


        if (!matchesText) {

          return false;

        }


        // ---------------------------------------
        // 태그 필터
        // ---------------------------------------

        if (
          normalizedActiveTag
        ) {

          const tags =
            Array.isArray(
              item.ai?.tags
            )
              ? item.ai.tags
              : [];


          const matchesTag =
            tags.some(
              (tag) =>
                normalizeAlbumSearch(
                  tag
                ) ===
                normalizedActiveTag
            );


          if (!matchesTag) {

            return false;

          }

        }


        return true;

      }
    );


  // ---------------------------------------------
  // 태그 버튼
  // ---------------------------------------------

  renderAllTagFilters();


  // ---------------------------------------------
  // 초기화 버튼
  // ---------------------------------------------

  allSearchClear.hidden =
    !allSearchText &&
    !activeAiTag;


  // ---------------------------------------------
  // 결과 개수
  // ---------------------------------------------

  if (
    allSearchText ||
    activeAiTag
  ) {

    allSearchCount.textContent =
      String(
        filteredItems.length
      ) +
      " / " +
      String(
        allMedia.length
      ) +
      "개";

  }

  else {

    allSearchCount.textContent =
      String(
        allMedia.length
      ) +
      "개의 기록";

  }


  // ---------------------------------------------
  // 검색 결과 없음
  // ---------------------------------------------

  if (
    filteredItems.length ===
      0
  ) {

    allGroups.innerHTML =
      "";


    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "empty-message";


    empty.textContent =
      "검색 결과가 없습니다.";


    allGroups.appendChild(
      empty
    );


    return;

  }


  // ---------------------------------------------
  // 기존처럼 월별 그룹 표시
  // ---------------------------------------------

  const monthGroupsAll =
    groupBy(
      filteredItems,
      getMonthKey
    );


  renderGroups(
    allGroups,
    monthGroupsAll,
    formatMonthTitle
  );

}

allSearchInput.addEventListener(
  "input",
  (event) => {

    allSearchText =
      event.target.value;


    renderAllFilteredView();

  }
);


allSearchClear.addEventListener(
  "click",
  () => {

    allSearchText =
      "";


    activeAiTag =
      "";


    allSearchInput.value =
      "";


    renderAllFilteredView();


    allSearchInput.focus();

  }
);


allTagFilters.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "[data-tag]"
      );


    if (!button) {

      return;

    }


    activeAiTag =
      button.dataset.tag ||
      "";


    renderAllFilteredView();

  }
);



// =====================================================
// AI Recommendation
// =====================================================

function getAiRecommendationScore(
  item
) {

  if (
    !item.ai ||
    item.ai.status !==
      "done"
  ) {

    return -1;

  }


  const bestShotScore =
    Number(
      item.ai.bestShotScore || 0
    );


  const momentScore =
    Number(
      item.ai.momentScore || 0
    );


  const qualityScore =
    Number(
      item.ai.qualityScore || 0
    );


  const favoriteBonus =
    item.favorite === true
      ? 5
      : 0;


  return (
    bestShotScore *
      0.55 +

    momentScore *
      0.35 +

    qualityScore *
      0.10 +

    favoriteBonus
  );

}

function getPureAiRecommendationScore(
  item
) {

  if (
    !item.ai ||
    item.ai.status !==
      "done"
  ) {

    return -1;

  }


  const bestShotScore =
    Number(
      item.ai.bestShotScore || 0
    );


  const momentScore =
    Number(
      item.ai.momentScore || 0
    );


  const qualityScore =
    Number(
      item.ai.qualityScore || 0
    );


  return (
    bestShotScore *
      0.55 +

    momentScore *
      0.35 +

    qualityScore *
      0.10
  );

}

function getRankedAiItems(
  items,
  limit
) {

  return [...items]

    .filter(
      (item) =>
        item.mediaType ===
          "photo" &&
        item.ai?.status ===
          "done" &&
        item.thumbnailDriveFileId
    )

    .sort(
      (a, b) => {

        const scoreDiff =
          getPureAiRecommendationScore(
            b
          ) -
          getPureAiRecommendationScore(
            a
          );


        if (
          scoreDiff !== 0
        ) {

          return scoreDiff;

        }


        return (
          getTakenMillis(b) -
          getTakenMillis(a)
        );

      }
    )

    .slice(
      0,
      limit
    );

}

function renderAiRankedGrid(
  container,
  items,
  emptyText
) {

  if (!container) {

    return;

  }


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

      const card =
        createMediaCard(
          item,
          index,
          items
        );


      card.classList.add(
        "ai-ranked-card"
      );


      const rankBadge =
        document.createElement(
          "span"
        );


      rankBadge.className =
        "ai-rank-badge";


      rankBadge.textContent =
        "#" +
        String(
          index + 1
        );


      const scoreBadge =
        document.createElement(
          "span"
        );


      scoreBadge.className =
        "ai-score-badge";


      scoreBadge.textContent =
        "AI " +
        String(
          Math.round(
            getPureAiRecommendationScore(
              item
            )
          )
        );


      card.appendChild(
        rankBadge
      );


      card.appendChild(
        scoreBadge
      );


      container.appendChild(
        card
      );

    }
  );

}

function renderTodayAiPick(
  todayItems
) {

  if (
    !todayAiPick ||
    !todayAiPickImage ||
    !todayAiPickScore ||
    !todayAiPickCaption ||
    !todayAiPickReason
  ) {

    return;

  }


  const candidates =
    todayItems.filter(
      (item) =>
        item.mediaType ===
          "photo" &&
        item.ai?.status ===
          "done" &&
        item.thumbnailDriveFileId
    );


  // AI 분석 완료 사진이 없으면
  // 대표카드를 숨김
  if (
    candidates.length === 0
  ) {

    todayAiPick.hidden =
      true;


    todayAiPickImage.removeAttribute(
      "src"
    );


    return;

  }


  // 추천 점수 높은 순
  // 동점이면 더 최근 사진 우선
  const ranked =
    [...candidates].sort(
      (a, b) => {

        const scoreDifference =
          getAiRecommendationScore(
            b
          ) -
          getAiRecommendationScore(
            a
          );


        if (
          scoreDifference !== 0
        ) {

          return scoreDifference;

        }


        return (
          getTakenMillis(b) -
          getTakenMillis(a)
        );

      }
    );


  const selected =
    ranked[0];


  const selectedIndex =
    todayItems.findIndex(
      (item) =>
        item.id ===
        selected.id
    );


  todayAiPickImage.src =
    getThumbnailUrl(
      selected
    );


  todayAiPickImage.alt =
    selected.ai?.caption ||
    selected.name ||
    "하진이 근황";


  todayAiPickScore.textContent =
    "베스트샷 " +
    String(
      Math.round(
        Number(
          selected.ai?.bestShotScore ||
          0
        )
      )
    ) +
    "점";


  todayAiPickCaption.textContent =
    selected.ai?.caption ||
    "최근 하진이의 모습";


  todayAiPickReason.textContent =
    selected.ai?.bestShotReason ||
    "";


  todayAiPickReason.hidden =
    !selected.ai?.bestShotReason;


  todayAiPick.hidden =
    false;


  // 클릭하면 기존 전체화면 Viewer
  todayAiPick.onclick =
    () => {

      openViewer(
        todayItems,
        selectedIndex
      );

    };


  todayAiPick.onkeydown =
    (event) => {

      if (
        event.key ===
          "Enter" ||
        event.key ===
          " "
      ) {

        event.preventDefault();


        openViewer(
          todayItems,
          selectedIndex
        );

      }

    };

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

// =============================================
// 하진이 근황
// 최근 7일 사진 중 AI 추천 대표사진
// =============================================
  
  const recent7DaysItems =
    allMedia.filter(
      (item) =>
        isWithinRecentDays(
          item,
          7
        )
    );
  
  renderTodayAiPick(
    recent7DaysItems
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

  const monthAiItems =
    getRankedAiItems(
      monthItems,
      5
    );
  
  
  if (
    monthAiItems.length > 0
  ) {
  
    monthAiSection.hidden =
      false;
  
  
    renderAiRankedGrid(
      monthAiGallery,
      monthAiItems,
      ""
    );
  
  }
  
  else {
  
    monthAiSection.hidden =
      true;
  
  
    monthAiGallery.innerHTML =
      "";
  
  }

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

  const aiBestItems =
    getRankedAiItems(
      allMedia,
      12
    );
  
  
  renderAiRankedGrid(
    aiBestGallery,
    aiBestItems,
    "아직 AI 분석이 완료된 사진이 없습니다."
  );


  // ---------------------------------------------------
  // 전체
  // ---------------------------------------------------
  
  renderAllFilteredView();

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

  let mediaQuery;

  // 관리자는 공개 + 비공개 전체 조회
  if (
    isAdmin &&
    currentUser
  ) {
  
    mediaQuery =
      query(
        collection(
          db,
          "media"
        )
      );
  
  }
  
  
  // 일반 방문자는 공개 항목만
  else {
  
    mediaQuery =
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
  
  }


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
    items.filter(
      (item) =>
        item.published === true
    );
  
  
  hiddenMedia =
    isAdmin
      ? items.filter(
          (item) =>
            item.published !== true
        )
      : [];
  
  
  renderViews();
  
  renderHiddenMedia();

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

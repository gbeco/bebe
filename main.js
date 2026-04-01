// --- 1. 설정 및 변수 ---
const BIRTH_DATE = new Date("2026-01-16");
const API_BASE = "https://developed-via-lessons-mental.trycloudflare.com";
let photoData = {};
let currentFilter = 'all'; // 현재 선택된 월 필터

const fileInput = document.getElementById('file-input');
const fab = document.getElementById('fab');
const timelineList = document.getElementById('timeline-list');
const backBtn = document.getElementById('back-btn');
const headerTitle = document.getElementById('header-title');

// --- 2. 초기화 및 데이터 로드 ---
function init() {
    updateDDay();
    loadPhotosFromServer();
}

function updateDDay() {
    const today = new Date();
    const diffTime = today.getTime() - BIRTH_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    document.getElementById('d-day-display').innerText = `태어난 지 +${diffDays}일`;
}

async function loadPhotosFromServer() {
    try {
        const response = await fetch(`${API_BASE}/photos`, { cache: "no-store" });
        if (!response.ok) throw new Error("서버 응답 없음");

        const filenames = await response.json();
        photoData = {};

        filenames.sort().reverse().forEach(name => {
            const dateStr = `${name.substring(0, 4)}-${name.substring(4, 6)}-${name.substring(6, 8)}`;
            const timeStr = `${name.substring(9, 11)}:${name.substring(11, 13)}`;

            if (!photoData[dateStr]) photoData[dateStr] = [];
            photoData[dateStr].push({
                src: `${API_BASE}/data/${name}`,
                name: name,
                time: timeStr
            });
        });

        createMonthButtons(); // 월별 버튼 생성
        renderTimeline();     // 타임라인 렌더링
    } catch (err) {
        console.error(err);
        timelineList.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold">서버 연결에 실패했습니다. 👶<br><span class="text-xs font-normal">Cloudflare 터널 상태를 확인해주세요.</span></div>`;
    }
}

// --- 3. 필터 및 버튼 로직 ---
function createMonthButtons() {
    const filterContainer = document.getElementById('month-filter');
    if (!filterContainer) return;

    filterContainer.innerHTML = `<button onclick="filterByMonth('all')" id="btn-all" class="filter-btn inline-block px-4 py-2 rounded-full text-sm font-bold bg-pink-500 text-white shadow-sm transition-all">전체</button>`;

    const months = Object.keys(photoData)
        .map(date => date.substring(0, 7))
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .sort().reverse();

    months.forEach(month => {
        const mm = month.split('-')[1];
        const btn = document.createElement('button');
        btn.id = `btn-${month}`;
        btn.className = "filter-btn inline-block px-4 py-2 rounded-full text-sm font-bold bg-gray-100 text-gray-600 transition-all";
        btn.innerText = `${parseInt(mm)}월`;
        btn.onclick = () => filterByMonth(month);
        filterContainer.appendChild(btn);
    });
}

function filterByMonth(month) {
    currentFilter = month;
    displayedDatesCount = PAGE_SIZE;

    // 1. 모든 필터 버튼을 찾아서 스타일 초기화
    const allButtons = document.querySelectorAll('.filter-btn');
    allButtons.forEach(btn => {
        // 사파리에서 가장 확실하게 클래스를 초기화하는 방법
        btn.className = "filter-btn inline-block px-4 py-2 rounded-full text-sm font-bold bg-gray-100 text-gray-600 transition-all";
    });

    // 2. 선택된 버튼의 ID를 정확히 타겟팅
    const targetId = (month === 'all') ? 'btn-all' : `btn-${month}`;
    const activeBtn = document.getElementById(targetId);

    if (activeBtn) {
        // 활성화 스타일을 강제로 주입 (!important 효과를 위해 className 변경)
        activeBtn.className = "filter-btn inline-block px-4 py-2 rounded-full text-sm font-bold bg-pink-500 text-white shadow-sm transition-all";
    }

    window.scrollTo(0, 0);
    renderTimeline();
}

// --- 화면 렌더링 상태 관리를 위한 변수 추가 ---
let displayedDatesCount = 3; // 처음에 보여줄 날짜 수
const PAGE_SIZE = 3;         // 스크롤 할 때마다 추가할 날짜 수
let isLoading = false;       // 중복 로딩 방지 플래그

// --- 4. 화면 렌더링 (타임라인 핵심 로직) ---
function renderTimeline() {
    // 필터링된 전체 날짜 목록 생성
    const allFilteredDates = Object.keys(photoData)
        .filter(date => currentFilter === 'all' || date.startsWith(currentFilter))
        .sort().reverse();

    if (allFilteredDates.length === 0) {
        timelineList.innerHTML = `<div class="text-center py-20 text-gray-400">기록이 없습니다.</div>`;
        return;
    }

    // 처음 실행하거나 필터가 바뀌었을 때만 리스트 초기화
    if (displayedDatesCount === PAGE_SIZE || timelineList.innerHTML.includes("사진 불러오는 중...")) {
        timelineList.innerHTML = '';
    }

    // 현재 페이지(최근 N일치)만큼만 잘라서 가져오기
    const datesToDisplay = allFilteredDates.slice(0, displayedDatesCount);

    // 기존 리스트와 비교하여 새로 추가된 날짜만 렌더링 (성능 최적화)
    const currentRenderedDates = Array.from(timelineList.querySelectorAll('section')).map(s => s.dataset.date);

    datesToDisplay.forEach(date => {
        if (currentRenderedDates.includes(date)) return; // 이미 그려진 날짜는 패스

        const photos = photoData[date];
        const section = document.createElement('section');
        section.dataset.date = date; // 날짜 식별용
        section.className = "flex space-x-4 cursor-pointer animate-fade-in mb-10";
        section.onclick = () => renderDetail(date);

        // ... [기존 getMediaTag 및 photoMarkup 생성 로직 유지] ...
        const getMediaTag = (photo, isSmall = false) => {
            const isVideo = photo.src.toLowerCase().endsWith('.mp4') || photo.src.toLowerCase().endsWith('.mov');
            return isVideo
                ? `<div class="relative w-full h-full bg-black"><video src="${photo.src}" preload="metadata" playsinline muted class="w-full h-full object-cover"></video><div class="absolute inset-0 bg-black/20 flex items-center justify-center text-white ${isSmall ? 'text-xs' : 'text-xl'}">▶️</div></div>`
                : `<img src="${photo.src}" class="w-full h-full object-cover">`;
        };

        let photoMarkup = photos.length === 1
            ? `<div class="w-full aspect-video rounded-2xl overflow-hidden border">${getMediaTag(photos[0])}</div>`
            : `<div class="grid grid-cols-2 gap-2 w-full aspect-video">
                <div class="rounded-2xl overflow-hidden border">${getMediaTag(photos[0])}</div>
                <div class="grid grid-rows-2 gap-2">
                    <div class="rounded-xl overflow-hidden border">${getMediaTag(photos[1], true)}</div>
                    <div class="rounded-xl overflow-hidden relative border bg-gray-50">
                        ${photos[2] ? getMediaTag(photos[2], true) : ''}
                        ${photos.length > 2 ? `<div class="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold">+${photos.length - 2}</div>` : ''}
                    </div>
                </div>
               </div>`;

        section.innerHTML = `
            <div class="w-8 h-8 bg-pink-400 rounded-full border-4 border-white shadow-sm flex-shrink-0 mt-1"></div>
            <div class="flex-1 bg-white p-4 rounded-3xl shadow-sm border border-gray-50 hover:shadow-md transition-all">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-bold text-gray-800">${date}</span>
                    <span class="text-xs text-gray-400">${photos.length}개의 기록</span>
                </div>
                ${photoMarkup}
            </div>
        `;
        timelineList.appendChild(section);
    });

    isLoading = false; // 로딩 완료
}

// --- 화면 렌더링 무한 스크롤 이벤트 리스너 추가 ---
window.addEventListener('scroll', () => {
    // 상세 화면이 아닐 때만 작동
    if (!backBtn.classList.contains('hidden')) return;

    // 스크롤이 바닥 근처(100px 남았을 때)에 도달했는지 확인
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        if (!isLoading) {
            const allFilteredDates = Object.keys(photoData)
                .filter(date => currentFilter === 'all' || date.startsWith(currentFilter));

            // 아직 더 보여줄 날짜가 남아있다면
            if (displayedDatesCount < allFilteredDates.length) {
                isLoading = true;
                displayedDatesCount += PAGE_SIZE; // 3일치 추가
                renderTimeline();
                console.log(`${displayedDatesCount}일치까지 로딩됨`);
            }
        }
    }
});

// 상세 화면 보기
function renderDetail(date) {
    timelineList.innerHTML = '';
    document.getElementById('timeline-line').style.display = 'none';
    backBtn.classList.remove('hidden');
    headerTitle.innerText = date;

    const detailContainer = document.createElement('div');
    detailContainer.className = "space-y-6 animate-fade-in";

    photoData[date].forEach((photo, idx) => {
        const isVideo = photo.src.toLowerCase().endsWith('.mp4') || photo.src.toLowerCase().endsWith('.mov');
        const mediaHtml = isVideo
            ? `<video src="${photo.src}" controls playsinline class="w-full h-auto rounded-t-3xl"></video>`
            : `<img src="${photo.src}" class="w-full h-auto saveable-image" onclick="downloadImage('${photo.src}', '${photo.name}')">`;

        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 pb-2 mb-6";
        card.innerHTML = `
            ${mediaHtml}
            <div class="p-5 flex justify-between items-center">
                <p class="text-xs font-bold text-pink-500">${isVideo ? '🎥 Video' : '📸 Moment'} ${idx + 1}</p>
                <span class="text-xs text-gray-400">${photo.time}</span>
            </div>
        `;
        detailContainer.appendChild(card);
    });
    timelineList.appendChild(detailContainer);
    window.scrollTo(0, 0);
}

// --- 5. 업로드, 다운로드 및 기타 로직 (생략 없이 유지) ---
// 업로드 버튼(+) 클릭 시 실행
let isAuthorized = false; // 인증 여부 상태 관리

fab.onclick = async () => {
    // [상태 2] 이미 인증된 경우 -> 바로 갤러리 열기 (사파리 허용)
    if (isAuthorized) {
        fileInput.click();
        return;
    }

    // [상태 1] 인증 전인 경우 -> 비밀번호 확인
    const password = prompt("사진 업로드는 엄빠만 가능해요! 비밀번호를 입력하세요.");
    if (!password) return;

    try {
        const response = await fetch(`${API_BASE}/check-pw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });

        if (response.ok) {
            // 인증 성공 처리
            isAuthorized = true;
            window.tempPassword = password;

            // 버튼 모양 변경 (업로드 메뉴로 변신)
            const fab = document.getElementById('fab');
            fab.classList.add('fab-active');
            document.getElementById('fab-icon').innerText = "📸"; // 아이콘 변경

            alert("인증되었습니다! 이제 버튼을 한 번 더 눌러 사진을 골라주세요.");
        } else {
            alert("비밀번호가 틀렸습니다. 🙅‍♂️");
        }
    } catch (err) {
        alert("서버 연결 실패");
    }
};

// 파일 업로드 완료 후 버튼 상태 초기화 (필요시)
// loadPhotosFromServer 마지막에 추가하면 보안상 더 좋습니다.
function resetFab() {
    isAuthorized = false;
    window.tempPassword = null;
    const fab = document.getElementById('fab');
    fab.classList.remove('fab-active');
    document.getElementById('fab-icon').innerText = "+";
}

// 업로드 전송
fileInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 현재 서버 파일 목록 확인 (중복 체크용)
    const existingFiles = new Set();
    Object.values(photoData).flat().forEach(photo => existingFiles.add(photo.name));

    const overlay = document.getElementById('upload-overlay');
    const statusTitle = document.getElementById('upload-status-title');
    const statusDetail = document.getElementById('upload-status-detail');
    const progressBar = document.getElementById('upload-progress-bar');

    overlay.style.display = 'flex';
    fab.disabled = true;

    let uploadCount = 0;
    let skipCount = 0;
    const total = files.length;

    for (let i = 0; i < total; i++) {
        const file = files[i];
        const photoDate = await getPhotoDate(file);
        const expectedName = `${photoDate}_${file.name}`;

        // 진행률 표시
        const percent = ((i + 1) / total) * 100;
        progressBar.style.width = `${percent}%`;
        statusDetail.innerHTML = `${total}개 중 ${i + 1}번째 처리 중...`;

        if (existingFiles.has(expectedName)) {
            skipCount++;
            continue;
        }

        const formData = new FormData();
        formData.append('photo', file);
        formData.append('taken_date', photoDate);
        formData.append('password', window.tempPassword);

        try {
            statusTitle.innerText = `📸 업로드 중...`;
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData
            });
            if (response.ok) uploadCount++;
        } catch (err) {
            console.error(err);
        }
    }

    // --- [수정 포인트] 업로드 완료 후 처리 ---
    statusTitle.innerText = "✅ 작업 완료!";
    statusDetail.innerHTML = `총 ${uploadCount}개 완료, ${skipCount}개 중복 제외`;

    setTimeout(() => {
        overlay.style.display = 'none';
        fab.disabled = false;
        fileInput.value = "";
        resetFab(); // 인증 해제 및 버튼 초기화

        // 1. 상세 페이지에서 메인으로 강제 이동
        // backBtn이 보이고 있다면(상세 페이지라면) 메인으로 돌아가게 함
        if (!backBtn.classList.contains('hidden')) {
            renderTimeline();
        }

        // 2. 전체 데이터를 새로 불러와서 갱신
        loadPhotosFromServer();

        // 3. 페이지 최상단으로 스크롤 이동
        window.scrollTo({ top: 0, behavior: 'smooth' });

    }, 1500);
};

function getPhotoDate(file) {
    return new Promise((resolve) => {
        EXIF.getData(file, function() {
            const dateStr = EXIF.getTag(this, "DateTimeOriginal");
            if (dateStr) resolve(dateStr.replace(/:/g, "").replace(" ", "_"));
            else {
                const lastMod = new Date(file.lastModified);
                const y = lastMod.getFullYear();
                const m = String(lastMod.getMonth() + 1).padStart(2, '0');
                const d = String(lastMod.getDate()).padStart(2, '0');
                const t = lastMod.toTimeString().split(' ')[0].replace(/:/g, "");
                resolve(`${y}${m}${d}_${t}`);
            }
        });
    });
}

// --- 다운로드 및 공유 기능 ---
async function downloadImage(imageSrc, fileName) {
    // 모바일(아이폰/안드로이드) 공유 기능 지원 여부 확인
    if (navigator.share && navigator.canShare) {
        try {
            const response = await fetch(imageSrc);
            if (!response.ok) throw new Error("파일 로드 실패");
            const blob = await response.blob();
            const file = new File([blob], fileName, { type: blob.type });

            // 공유 가능한 파일인지 한 번 더 체크
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: '하진이 사진'
                });
                console.log("공유 성공");
                return; // 성공 시 함수 종료 (URL 이동 안 함)
            }
        } catch (error) {
            // 사용자가 공유를 취소하거나 에러가 나면 여기로 옵니다.
            // 기존에 있던 performDownload() 호출을 삭제하여 URL 이동을 막습니다.
            if (error.name === 'AbortError') {
                console.log('사용자가 공유를 취소했습니다.');
            } else {
                console.error("공유 중 오류 발생:", error);
                // 에러가 났을 때만 알림 (취소했을 때는 안 뜸)
                if (error.name !== 'AbortError') {
                   alert("공유 기능을 사용할 수 없는 이미지입니다.");
                }
            }
            return; // 함수 종료 (URL 이동 안 함)
        }
    }

    // navigator.share가 없거나 실패한 경우에만 PC/호환성 다운로드 실행
    // 단, 모바일에서 이 코드가 실행되지 않도록 주의해야 합니다.
    // 위 catch 블록에서 return을 했으므로, navigator.share가 지원될 때는 이 아래로 안 옵니다.
    performDownload(imageSrc, fileName);
}

backBtn.onclick = renderTimeline;
init();
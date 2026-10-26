
const navItems =
  document.querySelectorAll(
    ".nav-item"
  );


const pageButtons =
  document.querySelectorAll(
    "[data-page]"
  );


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


  let target;


  if (
    page === "home"
  ) {

    target =
      document.getElementById(
        "todaySection"
      );

  }


  if (
    page === "month"
  ) {

    target =
      document.getElementById(
        "monthSection"
      );

  }


  if (
    page === "best"
  ) {

    target =
      document.getElementById(
        "bestSection"
      );

  }


  if (
    page === "all"
  ) {

    target =
      document.getElementById(
        "gallerySection"
      );

  }


  if (target) {

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
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


const adminButton =
  document.getElementById(
    "adminButton"
  );


adminButton.addEventListener(
  "click",
  () => {

    window.location.href =
      "https://hajin-album-api.madocho.workers.dev/auth/test-page";

  }
);

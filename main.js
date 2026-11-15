(() => {
  "use strict";

  document.documentElement.setAttribute("data-js-ready", "true");

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  /* ---------- Настройки приёма заявок ----------
     endpoint — URL вебхука (Google Apps Script, Cloudflare Worker,
     Formspree, Web3Forms и т. п.). Пока пусто — работает демо-режим.
     mode: "cors" — обычный запрос; "no-cors" — запасной вариант,
     если браузер блокирует чтение ответа Google Apps Script.
     Подробная инструкция — в README.md, раздел «Как получать заявки». */
  const LEAD_CONFIG = {
    endpoint: "https://script.google.com/macros/s/AKfycbzreRGMIrqKwRvCdC5ZjKJWdLw2F09arvz1E8UNrql4gvWjZtN9qqxZKKTBwgtenyVnRA/exec",
    mode: "cors",
    // "file" — фото уходит файлом (Telegram-бот, Formspree, свой backend).
    // "base64" — фото уходит строкой base64 (Google Apps Script → Google Drive).
    photoMode: "base64"
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });

  const sendLead = (data) => {
    if (!LEAD_CONFIG.endpoint) {
      return new Promise((resolve) => window.setTimeout(resolve, 850));
    }

    return fetch(LEAD_CONFIG.endpoint, {
      method: "POST",
      body: data,
      mode: LEAD_CONFIG.mode === "no-cors" ? "no-cors" : "cors"
    }).then((response) => {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      if (LEAD_CONFIG.mode === "no-cors") return response;

      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) return response;

      return response.json().then((result) => {
        if (result && result.ok === false) {
          throw new Error(result.error || "Сервер отклонил заявку");
        }
        return response;
      });
    });
  };

  const showFormError = (form) => {
    let error = form.querySelector(".form-error");
    if (!error) {
      error = document.createElement("p");
      error.className = "form-error";
      error.setAttribute("role", "alert");
      form.appendChild(error);
    }
    error.textContent = "Не удалось отправить заявку. Позвоните нам: +7 (495) 120-45-67";
  };

  /* ---------- Шапка при скролле ---------- */
  const header = $("#site-header");
  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Год в футере ---------- */
  $$("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- Мобильное меню ---------- */
  const menu = $("#mobile-menu");
  const menuToggle = $("[data-menu-toggle]");

  const setMenu = (open, restoreFocus = true) => {
    if (!menu || !menuToggle) return;
    document.body.classList.toggle("menu-open", open);
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");

    if (open) {
      const firstLink = menu.querySelector("a");
      if (firstLink) window.setTimeout(() => firstLink.focus(), 250);
    } else if (restoreFocus) {
      menuToggle.focus();
    }
  };

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      setMenu(!menu.classList.contains("is-open"));
    });
  }

  $$("#mobile-menu a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false, false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu && menu.classList.contains("is-open")) {
      setMenu(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180 && menu && menu.classList.contains("is-open")) {
      setMenu(false, false);
    }
  });

  /* ---------- Маска телефона ---------- */
  const digitsOf = (value) => value.replace(/\D/g, "");

  const formatPhone = (value) => {
    let digits = digitsOf(value);
    if (!digits) return "";
    if (digits[0] === "8") digits = "7" + digits.slice(1);
    if (digits[0] !== "7") digits = "7" + digits;
    digits = digits.slice(0, 11);

    if (digits.length === 1) return "+7 ";
    let result = "+7 (" + digits.slice(1, 4);
    if (digits.length >= 4) result += ")";
    if (digits.length > 4) result += " " + digits.slice(4, 7);
    if (digits.length > 7) result += "-" + digits.slice(7, 9);
    if (digits.length > 9) result += "-" + digits.slice(9, 11);
    return result;
  };

  $$("[data-phone]").forEach((input) => {
    input.addEventListener("input", () => {
      input.value = formatPhone(input.value);
      const field = input.closest(".field");
      if (field && digitsOf(input.value).length === 11) {
        field.classList.remove("is-invalid");
        input.setAttribute("aria-invalid", "false");
      }
    });

    input.addEventListener("blur", () => {
      if (digitsOf(input.value).length <= 1) input.value = "";
    });
  });

  /* ---------- Загрузка фото ---------- */
  const resetFile = (wrap) => {
    if (!wrap) return;
    const input = wrap.querySelector("[data-file-input]");
    const name = wrap.querySelector("[data-file-name]");
    wrap.classList.remove("has-file", "is-error");
    if (name) name.textContent = "Файл не выбран";
    if (input) input.value = "";
  };

  $$("[data-file-input]").forEach((input) => {
    const wrap = input.closest("[data-file]");
    const name = wrap ? wrap.querySelector("[data-file-name]") : null;

    input.addEventListener("change", () => {
      if (!wrap || !name) return;
      const file = input.files && input.files[0];

      if (!file) {
        resetFile(wrap);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        resetFile(wrap);
        wrap.classList.add("is-error");
        name.textContent = "Файл больше 10 МБ — выберите другой";
        window.setTimeout(() => resetFile(wrap), 3500);
        return;
      }

      wrap.classList.remove("is-error");
      wrap.classList.add("has-file");
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1).replace(".", ",");
      name.textContent = file.name + " · " + sizeMb + " МБ";
    });
  });

  /* ---------- Валидация и отправка форм ---------- */
  const markField = (input, invalid) => {
    const field = input.closest(".field");
    if (field) field.classList.toggle("is-invalid", invalid);
    input.setAttribute("aria-invalid", String(invalid));
  };

  const validateForm = (form) => {
    let firstInvalid = null;

    const nameInput = form.querySelector('input[name="name"]');
    if (nameInput) {
      const invalid = nameInput.value.trim().length < 2;
      markField(nameInput, invalid);
      if (invalid) firstInvalid = firstInvalid || nameInput;
    }

    const phoneInput = form.querySelector("[data-phone]");
    if (phoneInput) {
      const invalid = digitsOf(phoneInput.value).length !== 11;
      markField(phoneInput, invalid);
      if (invalid) firstInvalid = firstInvalid || phoneInput;
    }

    const consent = form.querySelector("[data-consent]");
    if (consent) {
      const consentWrap = consent.closest(".consent");
      const invalid = !consent.checked;
      if (consentWrap) consentWrap.classList.toggle("is-invalid", invalid);
      consent.setAttribute("aria-invalid", String(invalid));
      if (invalid) firstInvalid = firstInvalid || consent;
    }

    return { valid: !firstInvalid, firstInvalid };
  };

  $$("[data-lead-form]").forEach((form) => {
    const card = form.closest("[data-lead-card]");
    const submit = form.querySelector('button[type="submit"]');
    const originalSubmit = submit ? submit.innerHTML : "";

    form.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        if (input.name === "name" && input.value.trim().length >= 2) {
          markField(input, false);
        }
        if (input.matches("[data-phone]") && digitsOf(input.value).length === 11) {
          markField(input, false);
        }
      });
    });

    form.querySelectorAll("[data-consent]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          const consentWrap = checkbox.closest(".consent");
          if (consentWrap) consentWrap.classList.remove("is-invalid");
          checkbox.setAttribute("aria-invalid", "false");
        }
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = validateForm(form);

      if (!result.valid) {
        if (result.firstInvalid) result.firstInvalid.focus();
        return;
      }

      if (!submit || !card) return;

      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      submit.innerHTML = "Отправляем заявку…";

      const existingError = form.querySelector(".form-error");
      if (existingError) existingError.remove();

      const data = new FormData(form);
      data.append("source", card.dataset.leadSource || "site");
      data.append("page", location.href);
      data.append("sentAt", new Date().toISOString());

      const photoInput = form.querySelector('input[name="photo"]');
      const photoFile = photoInput && photoInput.files ? photoInput.files[0] : null;
      const prepareData = photoFile && LEAD_CONFIG.photoMode === "base64"
        ? fileToBase64(photoFile).then((base64) => {
            data.delete("photo");
            data.append("photoName", photoFile.name);
            data.append("photoType", photoFile.type || "image/jpeg");
            data.append("photoBase64", base64);
          })
        : Promise.resolve();

      const onSuccess = () => {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        submit.innerHTML = originalSubmit;

        form.reset();
        card.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
        card.querySelectorAll("[data-file]").forEach(resetFile);

        card.classList.add("is-success");
        const success = card.querySelector(".form-success");
        if (success) {
          success.setAttribute("tabindex", "-1");
          success.focus({ preventScroll: true });
        }
      };

      const onError = () => {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        submit.innerHTML = originalSubmit;
        showFormError(form);
      };

      prepareData.then(() => sendLead(data)).then(onSuccess).catch(onError);
    });

    const resetButton = card ? card.querySelector("[data-form-reset]") : null;
    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (!card) return;
        card.classList.remove("is-success");
        form.reset();
        card.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
        card.querySelectorAll("[data-file]").forEach(resetFile);
        const firstInput = form.querySelector('input[name="name"]');
        if (firstInput) firstInput.focus();
      });
    }
  });

  /* ---------- Модальная форма заявки ---------- */
  const leadModal = $("#lead-modal");

  const openLeadModal = () => {
    if (!leadModal) return;
    if (document.body.classList.contains("menu-open")) {
      document.body.classList.remove("menu-open");
      if (menu) menu.classList.remove("is-open");
      if (menu) menu.setAttribute("aria-hidden", "true");
      if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
    }

    if (typeof leadModal.showModal === "function") {
      leadModal.showModal();
    } else {
      leadModal.setAttribute("open", "");
    }
    document.body.classList.add("modal-open");
  };

  const closeLeadModal = () => {
    if (!leadModal) return;
    if (typeof leadModal.close === "function" && leadModal.open) {
      leadModal.close();
    } else {
      leadModal.removeAttribute("open");
      document.body.classList.remove("modal-open");
    }
  };

  $$("[data-open-lead]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openLeadModal();
    });
  });

  if (leadModal) {
    const closeButton = leadModal.querySelector("[data-close-lead]");
    if (closeButton) closeButton.addEventListener("click", closeLeadModal);

    leadModal.addEventListener("click", (event) => {
      if (event.target === leadModal) closeLeadModal();
    });

    leadModal.addEventListener("close", () => {
      document.body.classList.remove("modal-open");

      const card = leadModal.querySelector("[data-lead-card]");
      if (card && card.classList.contains("is-success")) {
        card.classList.remove("is-success");
        const form = card.querySelector("[data-lead-form]");
        if (form) form.reset();
        card.querySelectorAll("[data-file]").forEach(resetFile);
      }
    });
  }

  /* ---------- Индикатор прокрутки ---------- */
  const progress = $(".scroll-progress");
  let progressFrame = null;

  const updateProgress = () => {
    progressFrame = null;
    if (!progress) return;

    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progress.style.transform = "scaleX(" + value + ")";
  };

  const requestProgress = () => {
    if (progressFrame === null) {
      progressFrame = window.requestAnimationFrame(updateProgress);
    }
  };

  window.addEventListener("scroll", requestProgress, { passive: true });
  window.addEventListener("resize", requestProgress);
  requestProgress();

  /* ---------- Мягкий фокус на форме после кнопок «Заказать звонок» ---------- */
  $$('a[href="#hero-form"]:not([data-open-lead])').forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 640) return;
      window.setTimeout(() => {
        const input = $('#hero-form input[name="name"]');
        if (input) input.focus({ preventScroll: true });
      }, 700);
    });
  });

  /* ---------- Появление блоков при скролле ---------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealSelectors = [
    ".trust__item",
    ".section-head",
    ".pains__bridge",
    ".solution",
    ".solution-media",
    ".step",
    ".include",
    ".included__visual",
    ".waste-card",
    ".waste__note",
    ".process__cta",
    ".cta-card"
  ];

  if (!reduceMotion && "IntersectionObserver" in window) {
    const targets = $$(revealSelectors.join(","));
    targets.forEach((el, index) => {
      el.setAttribute("data-reveal", "");
      el.style.transitionDelay = Math.min(index % 4, 3) * 55 + "ms";
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Подсветка активного пункта меню ---------- */
  const navLinks = $$(".site-nav a");
  if (navLinks.length && "IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => link.removeAttribute("aria-current"));
          const active = navLinks.find((link) => link.getAttribute("href") === "#" + entry.target.id);
          if (active) active.setAttribute("aria-current", "true");
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );

    ["process", "waste", "included", "contacts"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }
})();

/* Дрова домой — логика лендинга.
   Заявки уходят в ту же Google Таблицу, что и первый лендинг. */
const LEAD_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbzreRGMIrqKwRvCdC5ZjKJWdLw2F09arvz1E8UNrql4gvWjZtN9qqxZKKTBwgtenyVnRA/exec",
  mode: "cors",
  source: "drova-site"
};

/* Ассортимент. Чтобы поменять цену или добавить позицию — правьте этот список
   (это и есть «простая админка» из ТЗ: данные в одном месте). */
const PRODUCTS = [
  {
    id: "bereza",
    title: "Берёза колотая",
    desc: "Самая жаркая и ходовая. Влажность 20–25%, поленья 25–30 см.",
    price: 6900,
    unit: "₽ за м³ с доставкой",
    tone: "#c98552"
  },
  {
    id: "osina",
    title: "Осина колотая",
    desc: "Для бань и каминов: ровное пламя, мало сажи, лёгкий запах.",
    price: 5900,
    unit: "₽ за м³ с доставкой",
    tone: "#d9a273"
  },
  {
    id: "sosna",
    title: "Сосна в чурках",
    desc: "Разжигает быстро, хорошо идёт в растопку и на дрова для бани.",
    price: 4500,
    unit: "₽ за м³ с доставкой",
    tone: "#e8bb8f"
  },
  {
    id: "setka",
    title: "Берёза в сетках",
    desc: "Сухие колотые поленья по 40–45 л. Удобно брать для мангала и печи.",
    price: 150,
    unit: "₽ за сетку",
    tone: "#f2cfae"
  }
];

function money(n) {
  return n.toLocaleString("ru-RU");
}

function woodIcon(tone) {
  return '<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">' +
    '<circle cx="15" cy="30" r="8" fill="' + tone + '" stroke="#3a2418" stroke-width="1.6"/>' +
    '<circle cx="33" cy="30" r="8" fill="' + tone + '" stroke="#3a2418" stroke-width="1.6"/>' +
    '<circle cx="24" cy="16" r="8" fill="#fbbf24" stroke="#3a2418" stroke-width="1.6"/>' +
    '<circle cx="15" cy="30" r="3" fill="none" stroke="#8d5a32" stroke-width="1.4"/>' +
    '<circle cx="33" cy="30" r="3" fill="none" stroke="#8d5a32" stroke-width="1.4"/>' +
    '<circle cx="24" cy="16" r="3" fill="none" stroke="#8d5a32" stroke-width="1.4"/>' +
    '</svg>';
}

function renderCatalog() {
  const host = document.getElementById("catalog-cards");
  if (!host) return;
  host.innerHTML = PRODUCTS.map(function (p) {
    return '<article class="card reveal">' +
      '<span class="card__icon">' + woodIcon(p.tone) + '</span>' +
      '<h3>' + p.title + '</h3>' +
      '<p class="card__desc">' + p.desc + '</p>' +
      '<p class="card__price">' + money(p.price) + ' <span class="card__unit">' + p.unit + '</span></p>' +
      '<button class="btn card__btn" type="button" data-buy="' + p.id + '">Заказать</button>' +
      '</article>';
  }).join("");
}

/* ---------- форма ---------- */
const modal = document.getElementById("lead-modal");
const card = modal ? modal.querySelector("[data-lead-card]") : null;
const form = modal ? modal.querySelector("form") : null;
const productSelect = document.getElementById("modal-product");

function openModal(productTitle) {
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  if (productTitle && productSelect) {
    const match = Array.prototype.find.call(productSelect.options, function (o) {
      return o.text.indexOf(productTitle) === 0;
    });
    if (match) productSelect.value = match.value;
  }
  const first = modal.querySelector("input");
  if (first) window.setTimeout(function () { first.focus(); }, 60);
}

function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  if (card) {
    card.querySelector("form").hidden = false;
    const success = card.querySelector(".form-success");
    const error = card.querySelector(".form-error");
    if (success) success.hidden = true;
    if (error) error.hidden = true;
  }
}

function digits(value) {
  return (value || "").replace(/\D/g, "");
}

function formatPhone(value) {
  let d = digits(value);
  if (d[0] === "8") d = "7" + d.slice(1);
  if (d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  let out = "+7";
  if (d.length > 1) out += " (" + d.slice(1, 4);
  if (d.length >= 4) out += ") " + d.slice(4, 7);
  if (d.length >= 7) out += "-" + d.slice(7, 9);
  if (d.length >= 9) out += "-" + d.slice(9, 11);
  return out;
}

function setError(name, text) {
  const el = document.querySelector('[data-error-for="' + name + '"]');
  if (el) el.textContent = text || "";
}

function validate(data) {
  let ok = true;
  setError("name", "");
  setError("phone", "");
  setError("consent", "");

  if ((data.get("name") || "").trim().length < 2) {
    setError("name", "Напишите, как к вам обращаться");
    ok = false;
  }
  if (digits(data.get("phone")).length !== 11) {
    setError("phone", "Нужен телефон из 11 цифр");
    ok = false;
  }
  if (!data.get("consent")) {
    setError("consent", "Без согласия мы не можем принять заявку");
    ok = false;
  }
  return ok;
}

async function submitLead(data) {
  data.append("source", LEAD_CONFIG.source);
  data.append("page", location.href);
  data.append("sentAt", new Date().toISOString());

  const response = await fetch(LEAD_CONFIG.endpoint, {
    method: "POST",
    body: data,
    mode: LEAD_CONFIG.mode === "no-cors" ? "no-cors" : "cors"
  });

  if (LEAD_CONFIG.mode === "no-cors") return true;
  if (!response.ok) throw new Error("HTTP " + response.status);
  const type = response.headers.get("content-type") || "";
  if (type.indexOf("application/json") === -1) return true;
  const json = await response.json();
  return json.ok !== false;
}

function initForm() {
  if (!form) return;

  const phone = document.getElementById("modal-phone");
  if (phone) {
    phone.addEventListener("input", function () {
      phone.value = phone.value.trim() ? formatPhone(phone.value) : "";
    });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const data = new FormData(form);
    if (!validate(data)) return;

    const submit = form.querySelector('button[type="submit"]');
    const error = card.querySelector(".form-error");
    submit.disabled = true;
    submit.textContent = "Отправляем…";
    if (error) error.hidden = true;

    try {
      await submitLead(data);
      form.hidden = true;
      const success = card.querySelector(".form-success");
      if (success) success.hidden = false;
      success.scrollIntoView({ block: "nearest" });
    } catch (e) {
      if (error) {
        error.textContent = "Не удалось отправить заявку. Позвоните: +7 (495) 120-45-67.";
        error.hidden = false;
      }
    } finally {
      submit.disabled = false;
      submit.textContent = "Отправить заявку";
    }
  });
}

/* ---------- калькулятор ---------- */
function initCalc() {
  const range = document.getElementById("calc-volume");
  const out = document.getElementById("calc-out");
  const price = document.getElementById("calc-price");
  if (!range || !out || !price) return;

  const perCubic = PRODUCTS[0].price;

  function update() {
    const v = Number(range.value);
    out.textContent = v;
    price.textContent = money(v * perCubic);
  }

  range.addEventListener("input", update);
  update();
}

/* ---------- появление блоков ---------- */
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
  items.forEach(function (el) { io.observe(el); });
}

document.addEventListener("click", function (event) {
  const open = event.target.closest("[data-open-lead]");
  if (open) {
    openModal();
    return;
  }
  const buy = event.target.closest("[data-buy]");
  if (buy) {
    const product = PRODUCTS.find(function (p) { return p.id === buy.dataset.buy; });
    openModal(product ? product.title : "");
    return;
  }
  if (event.target.closest("[data-close-lead]")) closeModal();
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeModal();
});

renderCatalog();
initForm();
initCalc();
initReveal();

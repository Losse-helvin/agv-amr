/* Ubepro — landing AGV/AMR v2 (sans GTM, sans CRM, sans vérification SMS) */
(() => {
  "use strict";

  const DOMAIN = "ubepro.com";
  const VERSION = "2026-11-27.v2";
  const TRACKING_STORAGE_KEY = "ubepro_tracking_v1";
  const TRACKING_PAGE_KEY = "ubepro_tracking_page_url_v1";

  const config = Object.assign(
    {
      googleScriptUrl:
        "https://script.google.com/macros/s/AKfycbwrbyCb9-cAmIRPGNvnb-aM-CkhQAerrkfP3_HSw-ewmThxsn4vbZt5daaq2aOnL01a1w/exec",
      formId: "a17629575110428r",
      debug: false
    },
    window.UBEPRO_CONFIG || {}
  );

  const googleScriptUrl = config.googleScriptUrl;
  const formId = config.formId || "a17629575110428r";
  const debugEnabled = config.debug === true;

  const TRACKING_FIELDS = [
    { key: "source", aliases: ["source", "utm_source", "ltm_source"] },
    { key: "categorie", aliases: ["categorie", "utm_category", "ltm_category", "category"] },
    { key: "user", aliases: ["user", "utm_user", "ltm_user"] },
    { key: "utm_source", aliases: ["utm_source", "ltm_source", "source"] },
    { key: "utm_medium", aliases: ["utm_medium", "medium"] },
    { key: "utm_campaign", aliases: ["utm_campaign", "campaign"] },
    { key: "utm_content", aliases: ["utm_content", "content"] },
    { key: "utm_term", aliases: ["utm_term", "term"] },
    { key: "utm_id", aliases: ["utm_id", "campaign_id"] },
    { key: "utm_category", aliases: ["utm_category", "ltm_category", "categorie", "category"] },
    { key: "utm_user", aliases: ["utm_user", "ltm_user", "user"] },
    { key: "ltm_source", aliases: ["ltm_source", "utm_source", "source"] },
    { key: "ltm_category", aliases: ["ltm_category", "utm_category", "categorie", "category"] },
    { key: "ltm_typ", aliases: ["ltm_typ", "utm_typ", "typ"] },
    { key: "ltm_user", aliases: ["ltm_user", "utm_user", "user"] },
    { key: "gclid", aliases: ["gclid"] },
    { key: "msclkid", aliases: ["msclkid"] },
    { key: "fbclid", aliases: ["fbclid"] }
  ];

  const cleanText = (value, maxLength = 500) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

  const sanitize = (value) => cleanText(value, 500).replace(/[<>]/g, "");

  const debugLog = (...args) => {
    if (debugEnabled) console.log("[ubepro]", ...args);
  };

  const entryUrl =
    typeof window.__UBEPRO_ENTRY_URL__ === "string"
      ? window.__UBEPRO_ENTRY_URL__
      : window.location.href;

  const parseQuery = (queryString) => {
    const result = Object.create(null);
    new URLSearchParams(queryString || "").forEach((value, key) => {
      const normalizedKey = String(key).trim().toLowerCase();
      const normalizedValue = sanitize(value);
      if (normalizedKey && normalizedValue) result[normalizedKey] = normalizedValue;
    });
    return result;
  };

  let trackingStore = (() => {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(TRACKING_STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const valid = {};
      for (const { key } of TRACKING_FIELDS) {
        if (typeof parsed[key] === "string") {
          const val = sanitize(parsed[key]);
          if (val) valid[key] = val;
        }
      }
      return valid;
    } catch (_) {
      return {};
    }
  })();

  let trackingPageUrl = cleanText(entryUrl, 1000);
  try {
    const storedPageUrl = window.sessionStorage.getItem(TRACKING_PAGE_KEY);
    if (storedPageUrl) {
      trackingPageUrl = storedPageUrl;
    } else if (trackingPageUrl) {
      window.sessionStorage.setItem(TRACKING_PAGE_KEY, trackingPageUrl);
    }
  } catch (_) {}

  const captureTracking = (url = window.location.href) => {
    const params = (() => {
      try {
        const parsedUrl = new URL(url, window.location.href);
        const hash = parsedUrl.hash.slice(1);
        const queryIdx = hash.indexOf("?");
        const hashQuery =
          queryIdx !== -1
            ? hash.slice(queryIdx + 1)
            : hash.includes("=") && !hash.startsWith("/")
              ? hash
              : "";
        return { ...parseQuery(hashQuery), ...parseQuery(parsedUrl.search) };
      } catch (_) {
        return {};
      }
    })();

    const captured = {};
    for (const { key, aliases } of TRACKING_FIELDS) {
      const matched = aliases.find((alias) => params[alias]);
      if (matched) captured[key] = params[matched];
    }

    if (Object.keys(captured).length > 0) {
      trackingStore = { ...trackingStore, ...captured };
      try {
        window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(trackingStore));
      } catch (_) {}
      trackingPageUrl = cleanText(url, 1000);
      try {
        window.sessionStorage.setItem(TRACKING_PAGE_KEY, trackingPageUrl);
      } catch (_) {}
    }

    return { ...trackingStore };
  };

  const getTracking = () => {
    const output = {};
    captureTracking();
    captureTracking(entryUrl);
    for (const { key } of TRACKING_FIELDS) {
      output[key] = sanitize(trackingStore[key]);
    }
    return output;
  };

  captureTracking();
  captureTracking(entryUrl);

  window.addEventListener("ubepro:cookie-preferences", () => {
    captureTracking();
    captureTracking(entryUrl);
  });
  document.addEventListener("ubepro:consent-changed", () => {
    captureTracking();
    captureTracking(entryUrl);
  });

  window.ubeproTracking = Object.freeze({
    version: VERSION,
    inspect: () => ({
      version: VERSION,
      current_url: window.location.href,
      page_url: cleanText(trackingPageUrl, 1000),
      values: getTracking()
    })
  });

  const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

  const isValidFrenchPhone = (raw) => {
    const digits = digitsOnly(raw);
    return /^0[1-9]\d{8}$/.test(digits) || /^(?:33|0033)[1-9]\d{8}$/.test(digits);
  };

  const formatPhoneInput = (raw) => {
    const trimmed = String(raw || "").trimStart();
    if (trimmed.startsWith("+")) {
      const digits = digitsOnly(trimmed).slice(0, 15);
      if (!digits) return "+";
      if (digits.startsWith("33") && digits.length > 2) {
        const rest = digits.slice(2, 11);
        const tail = rest.slice(1).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
        return tail ? `+33 ${rest[0]} ${tail}` : `+33 ${rest[0]}`;
      }
      return `+${digits}`;
    }
    const digits = digitsOnly(trimmed);
    if (/^0[1-9]/.test(digits)) {
      return digits
        .slice(0, 10)
        .replace(/(\d{2})(?=\d)/g, "$1 ")
        .trim();
    }
    return digits.slice(0, 15);
  };

  async function sendToSheet(params) {
    if (!googleScriptUrl) {
      return { target: "sheet", state: "error", error: new Error("URL Google Script manquante.") };
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
    try {
      const response = await fetch(googleScriptUrl, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: params,
        keepalive: true,
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let json = null;
      try {
        json = JSON.parse(await response.text());
      } catch (_) {
        json = null;
      }
      if (!json || json.status !== "ok") {
        throw new Error((json && json.message) || "Réponse inattendue du script Google.");
      }
      return { target: "sheet", state: "ok", response: json };
    } catch (error) {
      console.error("[ubepro] Google Sheet en échec :", error);
      return { target: "sheet", state: "error", error };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // Navigation mobile, onglets et formulaire d'étude
  (() => {
    const menuToggle = document.querySelector(".menu-toggle");
    const mobileNav = document.querySelector("#mobile-nav");
    const setMobileNavOpen = (open) => {
      menuToggle?.setAttribute("aria-expanded", String(open));
      if (mobileNav) mobileNav.hidden = !open;
    };

    menuToggle?.addEventListener("click", () => {
      setMobileNavOpen(menuToggle.getAttribute("aria-expanded") !== "true");
    });
    mobileNav?.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMobileNavOpen(false);
    });

    const tabsRoot = document.querySelector("[data-tabs]");
    if (tabsRoot) {
      const tabs = [...tabsRoot.querySelectorAll("[data-tab]")];
      const panels = [...tabsRoot.querySelectorAll("[data-panel]")];
      const activateTab = (tab) => {
        const target = tab.dataset.tab;
        tabs.forEach((btn) => {
          const active = btn === tab;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", String(active));
          btn.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => {
          const active = panel.dataset.panel === target;
          panel.classList.toggle("is-active", active);
          panel.hidden = !active;
        });
      };

      tabsRoot.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-tab]");
        if (tab && tabsRoot.contains(tab)) activateTab(tab);
      });

      tabsRoot.addEventListener("keydown", (event) => {
        const tab = event.target.closest("[data-tab]");
        if (!tab) return;
        const idx = tabs.indexOf(tab);
        if (idx === -1) return;
        let nextIdx = null;
        if (event.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIdx = 0;
        else if (event.key === "End") nextIdx = tabs.length - 1;
        if (nextIdx !== null) {
          event.preventDefault();
          activateTab(tabs[nextIdx]);
          tabs[nextIdx].focus();
        }
      });
    }

    captureTracking();

    const form = document.querySelector("#study-form");
    if (!form) return;

    const formCard = form.closest("[data-form-card]") || form.parentElement;
    const steps = [...form.querySelectorAll(".form-step")];
    const progressEl = formCard?.querySelector(".form-progress");
    const indexEl = formCard?.querySelector(".form-index");
    const formErrorEl = form.querySelector(".form-error");
    const successEl = form.querySelector(".form-success");
    const phoneInput = form.querySelector('input[name="telephone"]');
    const postalInput = form.querySelector('input[name="code_postal"]');
    const nextBtn = form.querySelector(".form-next");
    const backBtn = form.querySelector(".form-back");
    const submitBtn = form.querySelector('button[type="submit"]');

    let honeypot = form.querySelector('input[name="website"]');
    if (!honeypot) {
      honeypot = document.createElement("input");
      honeypot.type = "text";
      honeypot.name = "website";
      honeypot.tabIndex = -1;
      honeypot.autocomplete = "off";
      honeypot.setAttribute("aria-hidden", "true");
      honeypot.className = "hp-field";
      form.appendChild(honeypot);
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const getFieldErrorMessage = (field) => {
      if (field.type === "checkbox") {
        if (field.required && !field.checked) {
          return "Veuillez cocher cette case pour accepter d'être recontacté par téléphone.";
        }
        return "";
      }
      const value = String(field.value || "").trim();
      if (field.required && value === "") {
        return field.tagName === "SELECT"
          ? "Sélectionnez une option dans la liste."
          : "Ce champ est obligatoire.";
      }
      if (value === "") return "";
      if (field.name === "mail" && !EMAIL_RE.test(value)) {
        return "Saisissez une adresse email valide (ex. vous@entreprise.fr).";
      }
      if (field.name === "telephone" && !isValidFrenchPhone(value)) {
        return "Saisissez un numéro de téléphone français valide (10 chiffres, ex. 01 23 45 67 89 ou 06 12 34 56 78).";
      }
      if (field.name === "code_postal" && !/^\d{5}$/.test(value.replace(/\s+/g, ""))) {
        return "Le code postal doit contenir 5 chiffres (ex. 75001).";
      }
      return "";
    };

    const ensureErrorElement = (field) => {
      const container = field.closest("label") || field.parentElement;
      let errEl = container.querySelector(":scope > .field-error");
      if (!errEl) {
        errEl = document.createElement("span");
        errEl.className = "field-error";
        errEl.id = `err-${field.name}`;
        errEl.hidden = true;
        container.appendChild(errEl);
      }
      return errEl;
    };

    const syncDescribedBy = (field, errorId, hasError) => {
      const current = (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (hasError) current.push(errorId);
      if (current.length) field.setAttribute("aria-describedby", current.join(" "));
      else field.removeAttribute("aria-describedby");
    };

    const validateField = (field) => {
      const message = getFieldErrorMessage(field);
      const errEl = ensureErrorElement(field);
      const container = field.closest("label") || field.parentElement;

      errEl.textContent = message;
      errEl.hidden = !message;
      container.classList.toggle("is-invalid", Boolean(message));
      field.setAttribute("aria-invalid", String(Boolean(message)));
      syncDescribedBy(field, errEl.id, Boolean(message));
      field.setCustomValidity(message || "");
      return !message;
    };

    const validateStep = (stepEl) => {
      const fields = [...stepEl.querySelectorAll("input, select, textarea")].filter(
        (field) => field.type !== "hidden" && field.name !== "website"
      );
      const invalidFields = fields.filter((field) => !validateField(field));
      if (!invalidFields.length) {
        if (formErrorEl) formErrorEl.hidden = true;
        return invalidFields;
      }
      if (formErrorEl) {
        formErrorEl.textContent =
          invalidFields.length === 1
            ? "Un champ est à corriger dans cette étape."
            : `${invalidFields.length} champs sont à corriger dans cette étape.`;
        formErrorEl.hidden = false;
      }
      const firstInvalid = invalidFields[0];
      try {
        firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid.focus({ preventScroll: true });
      } catch (_) {}
      return invalidFields;
    };

    phoneInput?.addEventListener("input", () => {
      const formatted = formatPhoneInput(phoneInput.value);
      if (phoneInput.value !== formatted) phoneInput.value = formatted;
      if (phoneInput.dataset.touched) validateField(phoneInput);
    });

    postalInput?.addEventListener("input", () => {
      postalInput.value = String(postalInput.value || "").replace(/\D/g, "").slice(0, 5);
      if (postalInput.dataset.touched) validateField(postalInput);
    });

    form.addEventListener("focusout", (event) => {
      const field = event.target.closest?.("input, select, textarea");
      if (field && field.type !== "hidden" && field.name !== "website") {
        field.dataset.touched = "true";
        validateField(field);
      }
    });

    form.addEventListener("input", (event) => {
      const field = event.target.closest?.("input, select, textarea");
      if (field && field.name !== "website" && field.dataset.touched) {
        validateField(field);
      }
    });

    form.addEventListener("change", (event) => {
      const field = event.target.closest?.('select, input[type="checkbox"]');
      if (field) {
        field.dataset.touched = "true";
        validateField(field);
      }
    });

    let currentStep = 0;

    const showStep = (stepIndex) => {
      currentStep = stepIndex;
      steps.forEach((stepEl, idx) => {
        stepEl.hidden = idx !== stepIndex;
        stepEl.classList.toggle("is-active", idx === stepIndex);
      });
      if (indexEl) {
        indexEl.textContent = `ÉTUDE / ${String(stepIndex + 1).padStart(2, "0")}`;
      }
      if (progressEl) {
        let html = "";
        for (let i = 0; i < steps.length; i += 1) {
          html += i <= stepIndex ? "<i></i>" : "<b></b>";
        }
        progressEl.innerHTML = html;
      }
    };

    const goToStep2 = () => {
      if (!validateStep(steps[0]).length) showStep(1);
    };

    nextBtn?.addEventListener("click", goToStep2);
    backBtn?.addEventListener("click", () => {
      if (formErrorEl) formErrorEl.hidden = true;
      showStep(0);
    });

    const showSuccess = () => {
      steps.forEach((stepEl) => {
        stepEl.hidden = true;
      });
      if (successEl) successEl.hidden = false;
      if (progressEl) {
        progressEl.innerHTML = steps.map(() => "<i></i>").join("");
      }
      const privacyNote = formCard?.querySelector(".privacy-note");
      if (privacyNote) {
        privacyNote.textContent =
          "Merci pour votre demande. Nous revenons vers vous avec un premier regard sur votre contexte.";
      }
      try {
        formCard?.scrollIntoView({ behavior: "smooth", block: "center" });
        successEl?.querySelector("h2")?.focus?.({ preventScroll: true });
      } catch (_) {}
    };

    const showSubmitError = (message) => {
      if (formErrorEl) {
        formErrorEl.textContent = message;
        formErrorEl.hidden = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Réessayer l'envoi";
      }
    };

    const readQuestionLabel = (fieldName, fallback) => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      const label = field ? field.closest("label") : null;
      let text = "";
      if (label) {
        const textNode = [...label.childNodes].find(
          (node) => node.nodeType === 3 && node.textContent.trim()
        );
        text = textNode ? textNode.textContent : "";
      }
      return cleanText(text || fallback, 120).replace(/\s*\?$/, "");
    };

    const buildPayload = () => {
      const formData = Object.fromEntries(new FormData(form));
      const tracking = getTracking();
      const coordonnees = {
        nom: sanitize(formData.nom),
        prenom: sanitize(formData.prenom),
        mail: sanitize(formData.mail || formData.email).toLowerCase(),
        telephone: sanitize(formData.telephone),
        consentement_telephone: formData.consentement_telephone === "oui" ? "oui" : "non",
        societe: sanitize(formData.societe),
        code_postal: sanitize(formData.code_postal),
        civilite: sanitize(formData.civilite),
        ville: sanitize(formData.ville)
      };
      const questionnaires = {
        question_1: readQuestionLabel("site", "Type de site"),
        reponse_1: sanitize(formData.site),
        question_2: readQuestionLabel("solution", "Solution envisagée"),
        reponse_2: sanitize(formData.solution),
        question_3: readQuestionLabel("enjeu", "Enjeu principal"),
        reponse_3: sanitize(formData.enjeu)
      };
      const sheetData = {
        ...coordonnees,
        site: sanitize(formData.site),
        solution: sanitize(formData.solution),
        enjeu: sanitize(formData.enjeu),
        ...questionnaires,
        ...tracking,
        page_url: cleanText(trackingPageUrl, 1000),
        page_referrer: DOMAIN,
        user_agent: cleanText(navigator.userAgent, 300),
        langue: cleanText(navigator.language || "", 20)
      };
      return { formData, tracking, coordonnees, questionnaires, sheetData };
    };

    window.ubeproLead = {
      version: VERSION,
      config: { googleScriptUrl, formId },
      preview: () => ({ sheet: buildPayload().sheetData }),
      lastResults: null,
      last: () => window.ubeproLead.lastResults,
      tracking: getTracking
    };

    const generateLeadId = () => {
      try {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }
      } catch (_) {}
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const rand = (16 * Math.random()) | 0;
        return (char === "x" ? rand : (rand & 3) | 8).toString(16);
      });
    };

    let submitting = false;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;

      if (currentStep === 0) {
        goToStep2();
        return;
      }
      if (validateStep(steps[1]).length) return;

      if (honeypot && honeypot.value.trim() !== "") {
        debugLog("Honeypot rempli, envoi ignoré.");
        showSuccess();
        return;
      }

      if (formErrorEl) formErrorEl.hidden = true;
      submitting = true;

      let originalLabel = "";
      if (submitBtn) {
        originalLabel = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Envoi en cours…";
      }

      try {
        const { sheetData } = buildPayload();
        const leadId = generateLeadId();
        const params = new URLSearchParams();
        Object.entries(sheetData).forEach(([key, value]) => params.set(key, value));
        params.set("form_id", formId);
        params.set("id_lead", leadId);
        params.set("page_url", cleanText(trackingPageUrl, 1000));
        params.set("user_agent", cleanText(navigator.userAgent, 300));
        params.set("langue", cleanText(navigator.language || "", 20));

        debugLog("Google Sheet payload :", Object.fromEntries(params.entries()));

        let confirmed = false;
        const slowTimer = setTimeout(() => {
          if (!confirmed && submitBtn) submitBtn.textContent = "Enregistrement en cours…";
        }, 2500);

        const result = await sendToSheet(params);
        clearTimeout(slowTimer);

        window.ubeproLead.lastResults = [result];
        debugLog("Résultat :", result);

        if (result.state === "ok") {
          confirmed = true;
          showSuccess();
          if (submitBtn) {
            submitBtn.removeAttribute("aria-busy");
            submitBtn.innerHTML = originalLabel;
          }
        } else {
          console.warn("[ubepro] Google Sheet en échec :", result.error);
          showSubmitError(
            "Nous n'avons pas pu enregistrer votre demande. Vérifiez votre connexion puis réessayez, ou appelez le 07 56 98 60 82."
          );
          submitBtn?.removeAttribute("aria-busy");
        }
      } catch (error) {
        console.error("[ubepro] Échec de l'envoi du lead :", error);
        showSubmitError(
          "Nous n'avons pas pu enregistrer votre demande. Vérifiez votre connexion puis réessayez."
        );
        submitBtn?.removeAttribute("aria-busy");
      } finally {
        submitting = false;
      }
    });
  })();

  // Barre d'action mobile collante
  (() => {
    const stickyCta = document.querySelector("#sticky-cta");
    const formSection = document.querySelector("#etude");
    if (!stickyCta || !formSection || !("IntersectionObserver" in window)) return;

    const mobileMq = window.matchMedia("(max-width: 800px)");
    new IntersectionObserver(
      ([entry]) => {
        const visible =
          mobileMq.matches && !entry.isIntersecting && entry.boundingClientRect.top < 0;
        stickyCta.hidden = !visible;
        stickyCta.classList.toggle("is-visible", visible);
        document.body.classList.toggle("has-sticky", visible);
      },
      { threshold: 0.05 }
    ).observe(formSection);

    stickyCta.addEventListener("click", () => {
      setTimeout(() => {
        const activeStep = document.querySelector("#study-form .form-step.is-active");
        const firstInput =
          activeStep?.querySelector('input:not([type="hidden"]):not([name="website"]), textarea') ||
          document.querySelector('#study-form input:not([type="hidden"]):not([name="website"])');
        firstInput?.focus({ preventScroll: true });
      }, 420);
    });
  })();

  // Animations au défilement
  (() => {
    const revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.style.animationPlayState = "running";
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
    );

    revealItems.forEach((el) => {
      el.style.animationPlayState = "paused";
      observer.observe(el);
    });

    requestAnimationFrame(() => {
      revealItems.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.style.animationPlayState = "running";
        }
      });
    });
  })();
})();

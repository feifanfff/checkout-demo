const product = {
  name: 'iPhone 15 Case',
  hkAmount: 18800, // in cents
  nlAmount: 2500,  // in cents
};

const state = {
  country: 'HK',
  currency: 'HKD',
  amount: product.hkAmount,
  config: null,
  savedCards: [],
};

const priceEl = document.getElementById('price');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const countrySelect = document.getElementById('country');
const statusEl = document.getElementById('status');
const methodOptions = document.querySelectorAll('input[name="method"]');
const savedMethodLabel = document.getElementById('saved-method-label');
const savedForm = document.getElementById('saved-form');
const savedCardsListEl = document.getElementById('saved-cards-list');
const cardForm = document.getElementById('card-form');
const idealForm = document.getElementById('ideal-form');
const walletForm = document.getElementById('wallet-form');
const walletButtonContainer = document.getElementById('wallet-button');
const walletFallback = document.getElementById('wallet-fallback');
const paySavedCardBtn = document.getElementById('pay-saved-card');
const removeSavedCardBtn = document.getElementById('remove-saved-card');
const clearSavedCardsBtn = document.getElementById('clear-saved-cards');
const payCardBtn = document.getElementById('pay-card');
const payIdealBtn = document.getElementById('pay-ideal');
const resetBtn = document.getElementById('reset-checkout');
const googlePayScriptId = 'google-pay-script';
const framesScriptId = 'framesv2-script';
let framesInitialized = false;

const savedCardsStorageKey = 'savedCards';
const lastPaymentStatusStorageKey = 'checkout:lastPaymentStatus';

function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100);
  } catch (e) {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

function setStatus(message, isError = false, state = 'info') {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', !!isError);
  statusEl.classList.toggle('success', state === 'success');
  statusEl.classList.toggle('pending', state === 'pending');
}

function updateTotals() {
  priceEl.textContent = formatAmount(state.amount, state.currency);
  subtotalEl.textContent = formatAmount(state.amount, state.currency);
  totalEl.textContent = formatAmount(state.amount, state.currency);
}

function updateCountry(country) {
  state.country = country;
  if (country === 'HK') {
    state.currency = 'HKD';
    state.amount = product.hkAmount;
  } else {
    state.currency = 'EUR';
    state.amount = product.nlAmount;
  }
  updateTotals();
  toggleIdealAvailability();
}

function toggleIdealAvailability() {
  const idealOption = document.querySelector('input[value="ideal"]');
  if (state.currency === 'EUR') {
    idealOption.disabled = false;
    idealForm.querySelector('p').textContent = 'You will be redirected to your bank. iDEAL is available for EUR orders.';
  } else {
    idealOption.disabled = true;
    if (idealOption.checked) {
      document.querySelector('input[value="card"]').checked = true;
      showMethod('card');
    }
    idealForm.querySelector('p').textContent = 'Switch to EUR (NL) to enable iDEAL.';
  }
}

function showMethod(value) {
  savedForm.classList.toggle('hidden', value !== 'saved');
  cardForm.classList.toggle('hidden', value !== 'card');
  idealForm.classList.toggle('hidden', value !== 'ideal');
  walletForm.classList.toggle('hidden', value !== 'wallet');
}

function clearCardInputs() {
  const cardholderNameEl = document.getElementById('cardholder-name');
  if (cardholderNameEl) cardholderNameEl.value = '';
  const saveCardEl = document.getElementById('save-card');
  if (saveCardEl) {
    saveCardEl.checked = false;
    saveCardEl.defaultChecked = false;
    saveCardEl.removeAttribute('checked');
    saveCardEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const frames = window.Frames;
  if (!frames) return;

  const clearFns = ['clearForm', 'reset', 'clear'];
  const tryClear = () => {
    for (const fnName of clearFns) {
      if (typeof frames[fnName] !== 'function') continue;
      try {
        frames[fnName]();
        return true;
      } catch (err) {
        console.warn(`Failed to clear Frames via ${fnName}`, err);
      }
    }
    return false;
  };

  tryClear();
  setTimeout(tryClear, 50);
}

function loadSavedCards() {
  try {
    const raw = localStorage.getItem(savedCardsStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((card) => card && typeof card === 'object' && typeof card.sourceId === 'string');
  } catch (err) {
    console.warn('Failed to load saved cards', err);
    return [];
  }
}

function persistSavedCards(cards) {
  localStorage.setItem(savedCardsStorageKey, JSON.stringify(cards));
}

function formatSavedCardLabel(card) {
  const scheme = (card.scheme || 'Card').toString().toUpperCase();
  const last4 = (card.last4 || '••••').toString();
  const expiryMonth = card.expiryMonth ? String(card.expiryMonth).padStart(2, '0') : null;
  const expiryYear = card.expiryYear ? String(card.expiryYear) : null;
  const expiry = expiryMonth && expiryYear ? `exp ${expiryMonth}/${expiryYear.slice(-2)}` : 'exp —';
  return `${scheme} •••• ${last4}`;
}

function formatSavedCardNote(card) {
  const expiryMonth = card.expiryMonth ? String(card.expiryMonth).padStart(2, '0') : null;
  const expiryYear = card.expiryYear ? String(card.expiryYear) : null;
  const expiry = expiryMonth && expiryYear ? `Expiry ${expiryMonth}/${expiryYear}` : 'Expiry unavailable';
  return `${expiry} · Stored on this device`;
}

function getSelectedSavedCardId() {
  const selected = document.querySelector('input[name="saved-card-choice"]:checked');
  return selected ? selected.value : null;
}

function renderSavedCards() {
  const hasSavedCards = state.savedCards.length > 0;
  savedMethodLabel.classList.toggle('hidden', !hasSavedCards);
  savedCardsListEl.innerHTML = '';

  if (!hasSavedCards) {
    if (document.querySelector('input[name="method"]:checked')?.value === 'saved') {
      document.querySelector('input[value="card"]').checked = true;
      showMethod('card');
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  state.savedCards.forEach((card, index) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'saved-card-item';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'saved-card-choice';
    radio.value = card.sourceId;
    if (index === 0) radio.checked = true;

    const meta = document.createElement('div');
    meta.className = 'saved-card-meta';

    const title = document.createElement('div');
    title.textContent = formatSavedCardLabel(card);

    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = formatSavedCardNote(card);

    meta.appendChild(title);
    meta.appendChild(note);

    wrapper.appendChild(radio);
    wrapper.appendChild(meta);
    fragment.appendChild(wrapper);
  });

  savedCardsListEl.appendChild(fragment);
}

function extractSavedCardFromPayment(payment) {
  const source = payment && payment.source ? payment.source : null;
  const sourceId = source && typeof source.id === 'string' ? source.id : null;
  if (!sourceId) return null;

  const card = {
    sourceId,
    scheme: source.scheme || source.brand || source.type || 'card',
    last4: source.last4 || source.last_4 || null,
    expiryMonth: source.expiry_month || source.expiryMonth || null,
    expiryYear: source.expiry_year || source.expiryYear || null,
    addedAt: Date.now(),
  };

  if (card.last4) {
    card.last4 = String(card.last4).slice(-4);
  }
  return card;
}

async function fetchConfig() {
  const res = await fetch('/config');
  const data = await res.json();
  state.config = data;
  if (!data.publicKey) {
    setStatus('Missing Checkout.com public key. Set CHECKOUT_PUBLIC_KEY.', true);
  }
  return data;
}

function tryInitFrames(publicKey) {
  if (framesInitialized) return true;
  if (!window.Frames) {
    console.error('Frames library not loaded');
    setStatus('Payment fields failed to load. Check network/ad blockers for cdn.checkout.com.', true);
    return false;
  }
  const cardNumber = document.getElementById('card-number');
  const expiry = document.getElementById('expiry-date');
  const cvv = document.getElementById('cvv');
  if (!cardNumber || !expiry || !cvv) {
    console.error('Card frame containers missing in DOM.');
    return false;
  }

  try {
    Frames.init({
      publicKey,
      schemeChoice: true,
      cardholder: {
        name: 'Checkout Demo',
      },
      style: {
        base: { color: '#323416', fontFamily: '"Helvetica Neue", Arial, sans-serif' },
        focus: { color: '#8C9E6E' },
        valid: { color: '#323416' },
        invalid: { color: '#8b1a1a' },
      },
    });
    framesInitialized = true;
  } catch (err) {
    console.error('Frames init failed', err);
    return false;
  }

  Frames.addEventHandler(Frames.Events.CARD_VALIDATION_CHANGED, (event) => {
    if (event.isValid || !event.elementType) return;
    setStatus(`Check your ${event.elementType} field.`, true);
  });

  Frames.addEventHandler(Frames.Events.CARD_TOKENIZATION_FAILED, (event) => {
    setStatus(`Card tokenization failed: ${event.error.message || 'unknown error'}`, true);
  });

  Frames.addEventHandler(Frames.Events.CARD_TOKENIZED, async (event) => {
    setStatus('Creating card payment...');
    const cardholderName = document.getElementById('cardholder-name').value || 'Checkout Demo';
    const wantsSave = !!document.getElementById('save-card')?.checked;
    const result = await submitPayment('/api/payments/card', {
      token: event.token,
      amount: state.amount,
      currency: state.currency,
      reference: `card-${Date.now()}`,
      cardholder: cardholderName,
    });

    if (wantsSave && result.ok && !result.redirected) {
      const savedCard = extractSavedCardFromPayment(result.data);
      if (savedCard && !state.savedCards.some((card) => card.sourceId === savedCard.sourceId)) {
        state.savedCards.unshift(savedCard);
        persistSavedCards(state.savedCards);
        renderSavedCards();
      }
    }

    if (result.shouldReload) {
      setTimeout(() => {
        window.location.assign(window.location.pathname);
      }, 50);
    }
  });
  return true;
}

async function submitPayment(url, payload) {
  disableButtons(true);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  disableButtons(false);
  if (!res.ok || data.error) {
    const detail = data.details ? ` (${data.details.join(', ')})` : '';
    const req = data.request_id ? ` [${data.request_id}]` : '';
    setStatus(`Payment failed: ${data.error || res.statusText}${detail}${req}`, true);
    return { ok: false, data, redirected: false, shouldReload: false };
  }

  if (data._links && data._links.redirect && data._links.redirect.href) {
    setStatus('Redirecting to complete payment...', false, 'pending');
    window.location = data._links.redirect.href;
    return { ok: true, data, redirected: true, shouldReload: false };
  }

  const status = (data.status || 'processed').toLowerCase();
  if (status === 'captured' || status === 'authorized' || status === 'approved') {
    setStatus(`Payment status: ${data.status}`, false, 'success');
    clearCardInputs();
    disableButtons(true);
    showReset();
    const shouldReload = url === '/api/payments/card';
    if (shouldReload) {
      try {
        sessionStorage.setItem(lastPaymentStatusStorageKey, String(data.status || 'success'));
      } catch (_) {}
    }
    return { ok: true, data, redirected: false, shouldReload };
  } else {
    setStatus(`Payment status: ${data.status}`, false, 'pending');
  }
  return { ok: true, data, redirected: false, shouldReload: false };
}

function loadFramesScript() {
  if (window.Frames) return Promise.resolve();
  const existing = document.getElementById(framesScriptId);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Frames script')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = framesScriptId;
    script.src = 'https://cdn.checkout.com/js/framesv2.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Frames script'));
    document.head.appendChild(script);
  });
}

function loadGooglePayScript() {
  if (!window.isSecureContext) {
    setStatus('Wallet requires secure context (https or localhost). Use https:// or http://localhost.', true);
    return Promise.reject(new Error('Insecure context'));
  }
  if (document.getElementById(googlePayScriptId)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = googlePayScriptId;
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Pay script'));
    document.head.appendChild(script);
  });
}

function initEventHandlers() {
  countrySelect.addEventListener('change', (e) => {
    updateCountry(e.target.value);
  });

  paySavedCardBtn.addEventListener('click', async () => {
    const selectedId = getSelectedSavedCardId();
    if (!selectedId) {
      setStatus('Select a saved card first.', true);
      return;
    }
    setStatus('Creating saved card payment...');
    await submitPayment('/api/payments/saved-card', {
      sourceId: selectedId,
      amount: state.amount,
      currency: state.currency,
      reference: `saved-${Date.now()}`,
    });
  });

  removeSavedCardBtn.addEventListener('click', () => {
    const selectedId = getSelectedSavedCardId();
    if (!selectedId) {
      setStatus('Select a saved card to remove.', true);
      return;
    }
    state.savedCards = state.savedCards.filter((card) => card.sourceId !== selectedId);
    persistSavedCards(state.savedCards);
    renderSavedCards();
    setStatus('Saved card removed.');
  });

  clearSavedCardsBtn.addEventListener('click', () => {
    state.savedCards = [];
    persistSavedCards(state.savedCards);
    renderSavedCards();
    setStatus('Cleared saved cards.');
  });

  methodOptions.forEach((opt) => {
    opt.addEventListener('change', (e) => {
      showMethod(e.target.value);
    });
  });

  payCardBtn.addEventListener('click', async () => {
    setStatus('Tokenizing card...');
    try {
      await Frames.submitCard();
    } catch (err) {
      console.error(err);
      const message = err?.message || 'Card form invalid';
      setStatus(`Card validation failed: ${message}. Check number/expiry/CVC.`, true);
    }
  });

  payIdealBtn.addEventListener('click', async () => {
    if (state.currency !== 'EUR') {
      setStatus('Switch to Netherlands (EUR) to use iDEAL.', true);
      return;
    }
    setStatus('Starting iDEAL redirect...');
    await submitPayment('/api/payments/ideal', {
      amount: state.amount,
      currency: state.currency,
      reference: `ideal-${Date.now()}`,
      description: 'iDEAL payment for iPhone case',
    });
  });

  walletFallback.addEventListener('click', () => {
    setStatus('Loading wallet support...');
    loadGooglePayScript()
      .then(() => {
        setStatus('Checking wallet availability...');
        initGooglePay();
      })
      .catch((err) => {
        console.error(err);
        setStatus('Wallet script blocked or failed to load. Check network/ad blockers.', true);
      });
  });

  resetBtn.addEventListener('click', () => {
    resetCheckout();
  });
}

function showGooglePayButton(paymentsClient) {
  const button = paymentsClient.createButton({
    buttonColor: 'black',
    buttonType: 'pay',
    onClick: () => onGooglePayPressed(paymentsClient),
  });
  walletButtonContainer.innerHTML = '';
  walletButtonContainer.appendChild(button);
}

function buildGooglePayRequest() {
  const totalPrice = (state.amount / 100).toFixed(2);
  const merchantId = state.config.processingChannel || 'checkout_demo';

  const tokenizationSpecification = {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      gateway: 'checkoutltd',
      gatewayMerchantId: merchantId,
    },
  };

  const cardPaymentMethod = {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX'],
    },
    tokenizationSpecification,
  };

  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [cardPaymentMethod],
    merchantInfo: { merchantName: 'Checkout Demo' },
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice,
      currencyCode: state.currency,
    },
  };
}

function onGooglePayPressed(paymentsClient) {
  const request = buildGooglePayRequest();
  paymentsClient.loadPaymentData(request).then(async (paymentData) => {
    const tokenized = paymentData?.paymentMethodData?.tokenizationData?.token;
    if (!tokenized) {
      setStatus('Wallet token missing', true);
      return;
    }
    setStatus('Creating wallet payment...');
    await submitPayment('/api/payments/wallet', {
      token: tokenized,
      amount: state.amount,
      currency: state.currency,
      reference: `wallet-${Date.now()}`,
    });
  }).catch((err) => {
    console.error('Google Pay error', err);
    setStatus('Wallet payment was cancelled or unavailable.', true);
  });
}

function initGooglePay() {
  if (!window.google || !window.google.payments) {
    setStatus('Google Pay script not loaded yet.', true);
    return;
  }
  const paymentsClient = new google.payments.api.PaymentsClient({ environment: 'TEST' });
  const isReadyToPayRequest = {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [buildGooglePayRequest().allowedPaymentMethods[0]],
  };
  paymentsClient.isReadyToPay(isReadyToPayRequest).then((resp) => {
    if (resp.result) {
      showMethod('wallet');
      showGooglePayButton(paymentsClient);
      setStatus('Wallet ready. Use Google Pay if available.');
    } else {
      setStatus('Wallet not available on this device.', true);
    }
  }).catch((err) => {
    console.error(err);
    setStatus('Wallet check blocked. Allow pay.google.com / play.google.com and retry.', true);
  });
}

function waitForCardContainers(attempt = 0) {
  const ids = ['card-number', 'expiry-date', 'cvv'];
  const missing = ids.filter((id) => !document.getElementById(id));
  if (missing.length === 0) return Promise.resolve();
  if (attempt >= 20) return Promise.reject(new Error('Card fields not in DOM after waiting.'));
  return new Promise((resolve) => setTimeout(resolve, 100)).then(() => waitForCardContainers(attempt + 1));
}

async function bootstrap() {
  showMethod('card');
  updateCountry(state.country);
  initEventHandlers();
  state.savedCards = loadSavedCards();
  renderSavedCards();
  clearCardInputs();
  try {
    const last = sessionStorage.getItem(lastPaymentStatusStorageKey);
    if (last) {
      setStatus(`Payment status: ${last}`, false, 'success');
      sessionStorage.removeItem(lastPaymentStatusStorageKey);
    }
  } catch (_) {}
  const cfg = await fetchConfig();
  if (cfg.publicKey) {
    try {
      await loadFramesScript();
      await waitForCardContainers();
      let attempts = 0;
      while (attempts < 5 && !framesInitialized) {
        const ok = tryInitFrames(cfg.publicKey);
        if (ok) break;
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!framesInitialized) {
        setStatus('Payment fields failed to render. Check blockers and refresh.', true);
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Failed to load payment fields.', true);
    }
  }
  const urlParams = new URLSearchParams(window.location.search);
  const statusParam = urlParams.get('status');
  if (statusParam === 'success') setStatus('Returned from redirect: success');
  if (statusParam === 'failed') setStatus('Returned from redirect: failed', true);
  if (statusParam) clearCardInputs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch((err) => {
      console.error(err);
      setStatus('Failed to load checkout. Check console.', true);
    });
  });
} else {
  bootstrap().catch((err) => {
    console.error(err);
    setStatus('Failed to load checkout. Check console.', true);
  });
}

// Helpers for CTA state
function disableButtons(disabled) {
  payCardBtn.disabled = disabled;
  payIdealBtn.disabled = disabled;
  walletFallback.disabled = disabled;
  paySavedCardBtn.disabled = disabled;
}

function showReset() {
  resetBtn.classList.remove('hidden');
}

function resetCheckout() {
  window.location.assign(window.location.pathname);
}

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
};

const priceEl = document.getElementById('price');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const countrySelect = document.getElementById('country');
const statusEl = document.getElementById('status');
const methodOptions = document.querySelectorAll('input[name="method"]');
const cardForm = document.getElementById('card-form');
const idealForm = document.getElementById('ideal-form');
const walletForm = document.getElementById('wallet-form');
const walletButtonContainer = document.getElementById('wallet-button');
const walletFallback = document.getElementById('wallet-fallback');
const payCardBtn = document.getElementById('pay-card');
const payIdealBtn = document.getElementById('pay-ideal');
const googlePayScriptId = 'google-pay-script';
const framesScriptId = 'framesv2-script';
let framesInitialized = false;

function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / 100);
  } catch (e) {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', !!isError);
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
  cardForm.classList.toggle('hidden', value !== 'card');
  idealForm.classList.toggle('hidden', value !== 'ideal');
  walletForm.classList.toggle('hidden', value !== 'wallet');
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
    await submitPayment('/api/payments/card', {
      token: event.token,
      amount: state.amount,
      currency: state.currency,
      reference: `card-${Date.now()}`,
      cardholder: cardholderName,
    });
  });
  return true;
}

async function submitPayment(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const detail = data.details ? ` (${data.details.join(', ')})` : '';
    setStatus(`Payment failed: ${data.error || res.statusText}${detail}`, true);
    return;
  }

  if (data._links && data._links.redirect && data._links.redirect.href) {
    setStatus('Redirecting to complete payment...');
    window.location = data._links.redirect.href;
    return;
  }

  setStatus(`Payment status: ${data.status || 'processed'}`);
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

  methodOptions.forEach((opt) => {
    opt.addEventListener('change', (e) => {
      showMethod(e.target.value);
    });
  });

  payCardBtn.addEventListener('click', () => {
    setStatus('Tokenizing card...');
    Frames.submitCard();
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
    setStatus('Wallet availability check failed.', true);
  });
}

function waitForCardContainers(attempt = 0) {
  const ids = ['card-number', 'expiry-date', 'cvv'];
  const missing = ids.filter((id) => !document.getElementById(id));
  if (missing.length === 0) return Promise.resolve();
  if (attempt >= 10) return Promise.reject(new Error('Card fields not in DOM after waiting.'));
  return new Promise((resolve) => setTimeout(resolve, 100)).then(() => waitForCardContainers(attempt + 1));
}

async function bootstrap() {
  updateCountry(state.country);
  initEventHandlers();
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

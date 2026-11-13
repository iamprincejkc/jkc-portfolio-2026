<script setup lang="ts">
/**
 * The hero picture: what a client gets, drawn in HTML rather than shipped as
 * a screenshot. It costs no image request, stays sharp at any density, and
 * follows the page into dark mode.
 *
 * The business is invented and the caption says so. It is an example of the
 * work, not a client, and must never read as one.
 */
</script>

<template>
  <figure class="pm">
    <div
      class="pm__stage"
      role="img"
      aria-label="Example: a clinic's landing page on a phone, with buttons to message on Messenger, call, and get directions, and the Messenger chat that the button opens."
    >
      <div class="pm__phone" aria-hidden="true">
        <div class="pm__screen">
          <div class="pm__bar">
            <span class="pm__lock">
              <svg width="10" height="10" viewBox="0 0 24 24"><path fill="currentColor" d="M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1Zm2 0h8V8a4 4 0 1 0-8 0Z" /></svg>
            </span>
            lumendental.com
          </div>

          <div class="pm__hero">
            <span class="pm__blob pm__blob--a" />
            <span class="pm__blob pm__blob--b" />
            <div class="pm__hero-text">
              <span class="pm__tag">Family dentistry</span>
              <strong>Lumen Dental Clinic</strong>
              <span>Gentle care for the whole family</span>
            </div>
          </div>

          <div class="pm__body">
            <div class="pm__meta">
              <span class="pm__stars">★★★★★</span>
              <span>4.9 · 212 reviews</span>
            </div>
            <div class="pm__open"><span class="pm__dot" />Open today · 9:00 AM - 6:00 PM</div>

            <div class="pm__cta pm__cta--fb">
              <LandingIcon name="messenger" :size="15" />
              Message us on Messenger
            </div>
            <div class="pm__row">
              <div class="pm__cta">
                <LandingIcon name="phone" :size="14" />
                Call
              </div>
              <div class="pm__cta">
                <LandingIcon name="pin" :size="14" />
                Directions
              </div>
            </div>

            <div class="pm__label">Services</div>
            <div class="pm__chips">
              <span>Cleaning</span><span>Braces</span><span>Whitening</span><span>Fillings</span><span>Kids</span>
            </div>
          </div>
        </div>
      </div>

      <div class="pm__chat" aria-hidden="true">
        <div class="pm__chat-head">
          <span class="pm__avatar">L</span>
          <span>
            <strong>Lumen Dental</strong>
            <small>Typically replies in minutes</small>
          </span>
        </div>
        <p class="pm__bubble pm__bubble--in">Hi! Would you like to book a visit?</p>
        <p class="pm__bubble pm__bubble--out">Yes please, Saturday morning?</p>
      </div>

      <div class="pm__google" aria-hidden="true">
        <span class="pm__g-query">
          <LandingIcon name="search" :size="13" />
          dentist near me
        </span>
        <span class="pm__g-title">Lumen Dental Clinic</span>
        <span class="pm__g-meta">★ 4.9 · Open now · lumendental.com</span>
      </div>
    </div>
    <figcaption class="pm__caption">Example: a clinic's landing page. Its Messenger button opens a chat with the clinic's Facebook page.</figcaption>
  </figure>
</template>

<style scoped>
.pm {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/*
 * The side cards overlap the phone only where it shows nothing that matters:
 * the Google card over the top corner of the photo, the chat card over the
 * bottom of the service chips, hanging below the phone into the stage's
 * bottom padding.
 */
.pm__stage {
  position: relative;
  width: 100%;
  max-width: 480px;
  display: flex;
  justify-content: center;
  padding: 0 0 64px;
}

.pm__phone {
  width: 268px;
  border-radius: 40px;
  padding: 9px;
  background: #121110;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06) inset,
    0 30px 60px -24px rgba(23, 21, 15, 0.45),
    0 12px 24px -12px rgba(23, 21, 15, 0.25);
}

.pm__screen {
  overflow: hidden;
  border-radius: 32px;
  background: #fbfaf7;
  color: #1a1813;
  font-size: 12px;
  line-height: 1.35;
}

.pm__bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 10px 14px 8px;
  height: 26px;
  border-radius: 999px;
  background: #eceae4;
  color: #4d4a42;
  font-size: 11px;
  font-weight: 500;
}
.pm__lock {
  display: inline-flex;
  color: #1d7a46;
}

.pm__hero {
  position: relative;
  height: 150px;
  margin: 0 10px;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(150deg, #cfe7e2 0%, #a9d3cc 55%, #7fbdb3 100%);
}
.pm__blob {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
}
.pm__blob--a {
  width: 120px;
  height: 120px;
  right: -24px;
  top: -30px;
}
.pm__blob--b {
  width: 70px;
  height: 70px;
  right: 60px;
  top: 40px;
  background: rgba(255, 255, 255, 0.3);
}
.pm__hero-text {
  position: absolute;
  inset: auto 14px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #0f2b27;
}
.pm__hero-text strong {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.pm__hero-text span {
  font-size: 11px;
  opacity: 0.8;
}
.pm__tag {
  align-self: flex-start;
  margin-bottom: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  opacity: 1 !important;
}

.pm__body {
  padding: 12px 14px 18px;
}
.pm__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #57534a;
  font-size: 11px;
}
.pm__stars {
  color: #e0a21a;
  letter-spacing: 1px;
}
.pm__open {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #1d7a46;
}
.pm__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.pm__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid #dedbd3;
  background: #fff;
  font-weight: 600;
  font-size: 12px;
}
.pm__cta--fb {
  margin-top: 12px;
  border-color: transparent;
  background: #0866ff;
  color: #fff;
}
.pm__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 6px;
}

.pm__label {
  margin-top: 14px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b675e;
}
.pm__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}
.pm__chips span {
  padding: 4px 9px;
  border-radius: 999px;
  background: #eeebe3;
  font-size: 11px;
}

/* The two cards that sit off the phone: Messenger, and being found on Google. */
.pm__chat,
.pm__google {
  position: absolute;
  border-radius: 16px;
  background: var(--lp-surface);
  color: var(--lp-ink);
  border: 1px solid var(--lp-line);
  box-shadow: var(--lp-shadow);
  font-size: 12px;
}

.pm__chat {
  right: 0;
  bottom: 0;
  width: 200px;
  padding: 12px;
}
.pm__chat-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--lp-line);
}
.pm__chat-head strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
}
.pm__chat-head small {
  display: block;
  font-size: 10px;
  color: var(--lp-faint);
}
.pm__avatar {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #7fbdb3;
  color: #0f2b27;
  font-weight: 700;
  font-size: 12px;
}
.pm__bubble {
  width: fit-content;
  max-width: 85%;
  padding: 6px 10px;
  border-radius: 14px;
  font-size: 11.5px;
  line-height: 1.35;
}
.pm__bubble--in {
  background: var(--lp-surface-2);
}
.pm__bubble--out {
  margin: 6px 0 0 auto;
  /* Messenger's own blue in both themes: the lighter dark-mode accent fails contrast under white text. */
  background: #0866ff;
  color: #fff;
}

.pm__google {
  left: 0;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 172px;
  padding: 10px 12px;
}
.pm__g-query {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  margin-bottom: 3px;
  border-bottom: 1px solid var(--lp-line);
  color: var(--lp-muted);
  font-size: 11px;
}
.pm__g-title {
  color: var(--lp-fb);
  font-weight: 600;
  font-size: 12.5px;
}
.pm__g-meta {
  color: var(--lp-faint);
  font-size: 10.5px;
}

/* Narrow phones: the side cards tuck in so nothing runs off the screen. */
@media (max-width: 420px) {
  .pm__stage {
    max-width: 340px;
    padding-bottom: 100px;
  }
  .pm__phone {
    width: 240px;
  }
  .pm__chat {
    width: 176px;
    right: -4px;
  }
  .pm__google {
    display: none;
  }
}

.pm__caption {
  margin-top: 4px;
  font-size: 13px;
  color: var(--lp-faint);
  text-align: center;
}
</style>

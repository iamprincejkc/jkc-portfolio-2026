<script setup lang="ts">
import { FAQS, PROBLEMS, PROJECTS, SERVICES, STEPS } from '~/utils/landing/content'
import { landingGraph, LANDING_SEO } from '~/utils/landing/seo'
import { trackLanding } from '~/composables/useLandingAnalytics'

/**
 * The home page: websites and systems for small businesses, anywhere.
 *
 * Who reads it: a clinic, salon, restaurant or shop owner who opened a link
 * from an email, usually on a phone, usually with only a Facebook page today.
 * It answers, in order: what do I get, can he actually build it, how does it
 * work, what does it cost (a quote, negotiable), and how do I reach him.
 *
 * The personal portfolio that used to live here is at /me.
 *
 * Prerendered, no scroll effects, no images above the fold: the hero picture
 * is HTML (components/landing/PhoneMock.vue), so the headline is the LCP.
 */
definePageMeta({ layout: 'landing' })

const { siteUrl } = useRuntimeConfig().public
const base = String(siteUrl).replace(/\/$/, '')
const ogImage = `${base}${LANDING_SEO.ogImage.path}`

// Title, description, social cards and robots directives. The reasoning for
// each is in utils/landing/seo.ts.
useHead({ title: LANDING_SEO.title })
useSeoMeta({
  description: LANDING_SEO.description,
  robots: LANDING_SEO.robots,
  ogLocale: 'en_US',
  ogTitle: LANDING_SEO.socialTitle,
  ogDescription: LANDING_SEO.description,
  ogImage,
  ogImageWidth: LANDING_SEO.ogImage.width,
  ogImageHeight: LANDING_SEO.ogImage.height,
  ogImageAlt: LANDING_SEO.ogImage.alt,
  ogImageType: 'image/png',
  twitterTitle: LANDING_SEO.socialTitle,
  twitterDescription: LANDING_SEO.description,
  twitterImage: ogImage,
  twitterImageAlt: LANDING_SEO.ogImage.alt,
})

useHead({
  script: [
    {
      // Same key as app.vue's Person block, so this replaces it on this page
      // with one connected graph instead of two disconnected ones.
      type: 'application/ld+json',
      key: 'ld-person',
      innerHTML: JSON.stringify(landingGraph(base)),
    },
  ],
})

useLandingAnalytics()

const featured = SERVICES.filter((s) => s.featured)
const more = SERVICES.filter((s) => !s.featured)
</script>

<template>
  <main id="main">
    <!-- Hero -->
    <section id="top" class="lp-hero">
      <div class="lp-wrap lp-hero__grid">
        <div class="lp-hero__copy">
          <p class="lp-eyebrow">Senior Software Engineer · Websites for small businesses</p>
          <!--
            The H1 leads with "Websites": it is what the page offers and what
            people search for, and the promise follows it.
          -->
          <h1 class="lp-hero__title">
            Websites that turn the people who find you on Facebook into
            <span class="lp-serif lp-hero__accent">customers.</span>
          </h1>
          <p class="lp-hero__lead">
            I build fast landing pages for small businesses, connected to your Facebook page and Messenger, so anyone who
            finds you can see what you offer and message or call you in one tap. And when you need more, I build the
            system behind it too.
          </p>
          <div class="lp-hero__actions">
            <a href="#contact" class="lp-btn lp-btn--primary" @click="trackLanding({ event: 'cta_click', cta: 'hero_free_draft' })">
              Get a free first draft
              <LandingIcon name="arrow-right" :size="18" />
            </a>
            <a href="#work" class="lp-btn lp-btn--ghost" @click="trackLanding({ event: 'cta_click', cta: 'hero_see_work' })">See my work</a>
          </div>
          <ul class="lp-hero__proof">
            <li><LandingIcon name="check" :size="16" />5+ years building for companies in Japan, New Zealand and the Philippines</li>
            <li><LandingIcon name="check" :size="16" />You deal with me directly, not an agency</li>
          </ul>
        </div>
        <LandingPhoneMock class="lp-hero__visual" />
      </div>
    </section>

    <!-- Problems -->
    <section class="lp-section lp-band" aria-labelledby="problems-title">
      <div class="lp-wrap">
        <p class="lp-eyebrow">Sound familiar?</p>
        <h2 id="problems-title" class="lp-h2">Customers are looking for you. <span class="lp-serif">Make it easy</span> for them to choose you.</h2>
        <div class="lp-problems">
          <article v-for="(p, i) in PROBLEMS" :key="p.title" class="lp-problem">
            <span class="lp-problem__n">0{{ i + 1 }}</span>
            <h3>{{ p.title }}</h3>
            <p>{{ p.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Services -->
    <section id="services" class="lp-section" aria-labelledby="services-title">
      <div class="lp-wrap">
        <p class="lp-eyebrow">What I can build for you</p>
        <h2 id="services-title" class="lp-h2">From one page that gets you messages, to the <span class="lp-serif">system</span> that runs your shop.</h2>
        <p class="lp-lead">Start small with a landing page linked to your Facebook. Add booking, Google and the rest when you are ready.</p>

        <div class="lp-services">
          <article v-for="s in featured" :key="s.title" class="lp-card lp-card--featured">
            <span class="lp-card__icon" :class="{ 'lp-card__icon--fb': s.icon === 'messenger' }"><LandingIcon :name="s.icon" :size="22" /></span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.body }}</p>
            <ul class="lp-card__points">
              <li v-for="pt in s.points" :key="pt"><LandingIcon name="check" :size="16" />{{ pt }}</li>
            </ul>
          </article>
          <article v-for="s in more" :key="s.title" class="lp-card">
            <span class="lp-card__icon"><LandingIcon :name="s.icon" :size="22" /></span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Work -->
    <section id="work" class="lp-section lp-band" aria-labelledby="work-title">
      <div class="lp-wrap">
        <div class="lp-work__head">
          <div>
            <p class="lp-eyebrow">Work I've built</p>
            <h2 id="work-title" class="lp-h2">Real sites, used by real <span class="lp-serif">businesses</span> every day.</h2>
            <p class="lp-lead">
              Websites and platforms I built and look after as a software engineer at OSL International. Open any of them and
              judge for yourself.
            </p>
          </div>
        </div>

        <div class="lp-work">
          <a v-for="p in PROJECTS" :key="p.name" :href="p.url" target="_blank" rel="noopener noreferrer" class="lp-project">
            <div class="lp-project__shot">
              <img :src="p.image" :alt="`${p.name} website`" width="1280" height="800" loading="lazy" decoding="async" />
            </div>
            <div class="lp-project__body">
              <p class="lp-project__kind">{{ p.kind }} · {{ p.where }}</p>
              <h3>{{ p.name }}</h3>
              <p>{{ p.body }}</p>
              <span class="lp-project__link">
                {{ p.host }}
                <LandingIcon name="arrow-up-right" :size="16" />
              </span>
            </div>
          </a>
        </div>

        <p class="lp-work__more">
          Before that: internal systems for a pawnshop and jewelry chain here in the Philippines, and hospital records software
          at Fujitsu.
          <a href="/me/">See all my work and background <LandingIcon name="arrow-right" :size="16" /></a>
        </p>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="lp-section" aria-labelledby="how-title">
      <div class="lp-wrap">
        <p class="lp-eyebrow">How it works</p>
        <h2 id="how-title" class="lp-h2">Simple, and you see it <span class="lp-serif">before</span> you pay for it.</h2>
        <ol class="lp-steps">
          <li v-for="(s, i) in STEPS" :key="s.title" class="lp-step">
            <span class="lp-step__n">{{ i + 1 }}</span>
            <h3>{{ s.title }}</h3>
            <p>{{ s.body }}</p>
          </li>
        </ol>

        <div class="lp-price">
          <div>
            <h3>What does it cost?</h3>
            <p>
              Every business is different, so I quote each project on its own, and the price is open to discussion. You get a
              fixed price before any work starts, and you can pay in parts.
            </p>
          </div>
          <a href="#contact" class="lp-btn lp-btn--primary" @click="trackLanding({ event: 'cta_click', cta: 'pricing_quote' })">Ask for a quote</a>
        </div>
      </div>
    </section>

    <!-- About, short -->
    <section class="lp-section lp-band" aria-labelledby="about-title">
      <div class="lp-wrap lp-about">
        <img src="/images/main.webp" alt="Jan Kevin" width="500" height="500" loading="lazy" decoding="async" class="lp-about__photo" />
        <div>
          <p class="lp-eyebrow">Who you'll work with</p>
          <h2 id="about-title" class="lp-h2">Hi, I'm Jan Kevin.</h2>
          <p class="lp-lead">
            I'm a Senior Software Engineer based in Cebu City, Philippines. I've spent more than five years building websites
            and business systems for companies in Japan, New Zealand and the Philippines. Now I help small businesses get found
            and win customers online, wherever they are. I take on a few projects at a time, so you always talk to the person
            doing the work.
          </p>
          <div class="lp-about__links">
            <a href="/me/" class="lp-btn lp-btn--ghost lp-btn--sm">Jan Kevin's full profile</a>
            <a href="https://ph.linkedin.com/in/iamprincejkc" target="_blank" rel="noopener noreferrer" class="lp-btn lp-btn--ghost lp-btn--sm">
              LinkedIn
              <LandingIcon name="arrow-up-right" :size="16" />
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="lp-section" aria-labelledby="faq-title">
      <div class="lp-wrap lp-faq">
        <div>
          <p class="lp-eyebrow">Questions</p>
          <h2 id="faq-title" class="lp-h2">Good to <span class="lp-serif">know.</span></h2>
          <p class="lp-lead">Anything else, just ask. There are no silly questions about your own business.</p>
        </div>
        <div class="lp-faq__list">
          <details v-for="f in FAQS" :key="f.q" class="lp-qa">
            <summary>
              {{ f.q }}
              <span class="lp-qa__icon"><LandingIcon name="plus" :size="18" /></span>
            </summary>
            <p>{{ f.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <LandingContact />
  </main>
</template>

<style scoped>
/* ---------- Hero ---------- */
.lp-hero {
  padding-block: 40px 64px;
}
@media (min-width: 960px) {
  .lp-hero {
    padding-block: 72px 112px;
  }
}
.lp-hero__grid {
  display: grid;
  gap: 48px;
  align-items: center;
}
@media (min-width: 960px) {
  .lp-hero__grid {
    grid-template-columns: 1.15fr 1fr;
    gap: 56px;
  }
}
.lp-hero__title {
  margin-top: 18px;
  font-size: clamp(36px, 5.4vw, 58px);
  line-height: 1.04;
  letter-spacing: -0.035em;
  font-weight: 600;
  text-wrap: balance;
}
.lp-hero__accent {
  color: var(--lp-accent);
}
.lp-hero__lead {
  margin-top: 22px;
  max-width: 54ch;
  font-size: 19px;
  line-height: 1.6;
  color: var(--lp-muted);
  text-wrap: pretty;
}
.lp-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}
@media (max-width: 479px) {
  .lp-hero__actions .lp-btn {
    flex: 1 1 100%;
  }
}
.lp-hero__proof {
  display: grid;
  gap: 8px;
  margin-top: 28px;
  font-size: 15px;
  color: var(--lp-muted);
}
.lp-hero__proof li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.lp-hero__proof :deep(svg) {
  margin-top: 4px;
  color: var(--lp-accent);
}

/* ---------- Bands ---------- */
.lp-band {
  background: var(--lp-band);
}

/* ---------- Problems ---------- */
.lp-problems {
  display: grid;
  gap: 16px;
  margin-top: 40px;
}
@media (min-width: 860px) {
  .lp-problems {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}
.lp-problem {
  padding: 28px;
  border-radius: var(--lp-radius);
  background: var(--lp-bg);
  border: 1px solid var(--lp-line);
}
.lp-problem__n {
  font-family: 'Melodrama', Georgia, serif;
  font-size: 28px;
  line-height: 1;
  color: var(--lp-accent);
}
.lp-problem h3 {
  margin-top: 18px;
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.lp-problem p {
  margin-top: 10px;
  color: var(--lp-muted);
  font-size: 16px;
}

/* ---------- Services ---------- */
.lp-services {
  display: grid;
  gap: 16px;
  margin-top: 48px;
}
@media (min-width: 700px) {
  .lp-services {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .lp-services {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
  .lp-card--featured {
    grid-column: span 2;
  }
}
.lp-card {
  display: flex;
  flex-direction: column;
  padding: 28px;
  border-radius: var(--lp-radius);
  background: var(--lp-surface);
  border: 1px solid var(--lp-line);
}
.lp-card--featured {
  padding: 32px;
  box-shadow: var(--lp-shadow);
}
.lp-card__icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--lp-accent-soft);
  color: var(--lp-accent);
}
.lp-card__icon--fb {
  background: color-mix(in srgb, var(--lp-fb) 12%, transparent);
  color: var(--lp-fb);
}
.lp-card h3 {
  margin-top: 20px;
  font-size: 19px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.lp-card--featured h3 {
  font-size: 23px;
}
.lp-card p {
  margin-top: 10px;
  color: var(--lp-muted);
  font-size: 16px;
}
.lp-card__points {
  display: grid;
  gap: 8px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--lp-line);
  font-size: 15px;
}
@media (min-width: 520px) {
  .lp-card__points {
    grid-template-columns: 1fr 1fr;
    column-gap: 16px;
  }
}
.lp-card__points li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.lp-card__points :deep(svg) {
  margin-top: 4px;
  color: var(--lp-ok);
}

/* ---------- Work ---------- */
.lp-work {
  display: grid;
  gap: 20px;
  margin-top: 48px;
}
@media (min-width: 760px) {
  .lp-work {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}
.lp-project {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--lp-radius);
  background: var(--lp-bg);
  border: 1px solid var(--lp-line);
  transition:
    border-color 0.2s ease,
    transform 0.25s ease,
    box-shadow 0.25s ease;
}
.lp-project:hover {
  border-color: var(--lp-line-strong);
  box-shadow: var(--lp-shadow);
  transform: translateY(-2px);
}
.lp-project__shot {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-bottom: 1px solid var(--lp-line);
  background: var(--lp-surface-2);
}
.lp-project__shot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transition: transform 0.5s ease;
}
.lp-project:hover .lp-project__shot img {
  transform: scale(1.02);
}
.lp-project__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 24px;
}
.lp-project__kind {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--lp-faint);
}
.lp-project h3 {
  margin-top: 8px;
  font-size: 21px;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.lp-project__body > p:not(.lp-project__kind) {
  margin-top: 8px;
  color: var(--lp-muted);
  font-size: 16px;
}
.lp-project__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 16px;
  font-size: 15px;
  font-weight: 500;
  color: var(--lp-accent);
}
.lp-work__more {
  margin-top: 32px;
  max-width: 70ch;
  color: var(--lp-muted);
  font-size: 16px;
}
.lp-work__more a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--lp-ink);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--lp-line-strong);
  text-underline-offset: 4px;
}
.lp-work__more a:hover {
  text-decoration-color: currentColor;
}

/* ---------- Steps ---------- */
.lp-steps {
  display: grid;
  gap: 16px;
  margin-top: 48px;
  counter-reset: none;
}
@media (min-width: 700px) {
  .lp-steps {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .lp-steps {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
}
.lp-step {
  padding: 28px 24px;
  border-radius: var(--lp-radius);
  border: 1px solid var(--lp-line);
}
.lp-step__n {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--lp-btn-bg);
  color: var(--lp-btn-fg);
  font-size: 15px;
  font-weight: 600;
}
.lp-step h3 {
  margin-top: 18px;
  font-size: 18px;
  line-height: 1.3;
  font-weight: 600;
}
.lp-step p {
  margin-top: 8px;
  color: var(--lp-muted);
  font-size: 15.5px;
}

.lp-price {
  display: grid;
  gap: 20px;
  align-items: center;
  margin-top: 24px;
  padding: 28px;
  border-radius: var(--lp-radius);
  background: var(--lp-accent-soft);
}
@media (min-width: 760px) {
  .lp-price {
    grid-template-columns: 1fr auto;
    gap: 40px;
    padding: 32px 36px;
  }
}
.lp-price h3 {
  font-size: 20px;
  font-weight: 600;
}
.lp-price p {
  margin-top: 6px;
  max-width: 64ch;
  color: var(--lp-muted);
  font-size: 16px;
}

/* ---------- About ---------- */
.lp-about {
  display: grid;
  gap: 32px;
  align-items: center;
}
@media (min-width: 760px) {
  .lp-about {
    grid-template-columns: 200px 1fr;
    gap: 56px;
  }
}
.lp-about__photo {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--lp-line);
}
@media (min-width: 760px) {
  .lp-about__photo {
    width: 200px;
    height: 200px;
  }
}
.lp-about .lp-h2 {
  margin-top: 10px;
}
.lp-about__links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

/* ---------- FAQ ---------- */
.lp-faq {
  display: grid;
  gap: 40px;
}
@media (min-width: 960px) {
  .lp-faq {
    grid-template-columns: 4fr 7fr;
    gap: 72px;
    align-items: start;
  }
}
.lp-faq__list {
  border-top: 1px solid var(--lp-line);
}
.lp-qa {
  border-bottom: 1px solid var(--lp-line);
}
.lp-qa summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 64px;
  padding: 16px 0;
  cursor: pointer;
  list-style: none;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}
.lp-qa summary::-webkit-details-marker {
  display: none;
}
.lp-qa__icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--lp-line-strong);
  transition: transform 0.25s ease;
}
.lp-qa[open] .lp-qa__icon {
  transform: rotate(45deg);
}
.lp-qa p {
  padding: 0 48px 22px 0;
  color: var(--lp-muted);
  font-size: 16.5px;
}
</style>

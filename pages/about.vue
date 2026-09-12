<script setup lang="ts">
/**
 * The long version.
 *
 * The home page carries a three-line summary and a link here; this page is
 * where the rest of it lives - how the five years actually went, what I reach
 * for and why, and the people it is all for.
 *
 * Splitting it this way is the point. A home page has to answer "can this
 * person build the thing" in about a screen; a biography does not fit inside
 * that and was quietly making the answer slower to reach.
 */
const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')

const DESCRIPTION =
  'Jan Kevin Cadampog — a full-stack developer in Cebu City. Five years of .NET and Angular, what I have shipped, how I like to work, and the people behind it.'

useHead({ title: 'About — Jan Kevin Cadampog' })

useSeoMeta({
  description: DESCRIPTION,
  ogTitle: 'About — Jan Kevin Cadampog',
  ogDescription: DESCRIPTION,
  ogUrl: `${siteUrl}/about`,
  twitterTitle: 'About — Jan Kevin Cadampog',
  twitterDescription: DESCRIPTION,
})

/** What I actually do all day, rather than a list of technologies. */
const principles = [
  {
    title: 'Enterprise systems, not demos',
    body: 'Most of my work runs inside companies rather than on a landing page — pawnshop ledgers, healthcare records, compliance tooling. Software people are obliged to use, where a bug is somebody\'s afternoon.',
  },
  {
    title: 'The boring parts are the job',
    body: 'Change requests, production support, the ticket nobody wants at 5pm on a Friday. Five years of that teaches you more about how systems really fail than any greenfield rebuild.',
  },
  {
    title: 'Build the small thing properly',
    body: 'The tools on this site — a QR generator with hand-written vector exporters, a searchable index of two thousand n8n workflows, a directory of every public API worth knowing — exist because I wanted to find out how. They are the honest version of a side project: finished, and out where people can use them.',
  },
]
</script>

<template>
  <main>
    <section class="about-hero">
      <div class="container-edge">
        <p class="eyebrow mb-6">About</p>
        <!--
          No hard <br /> in the first clause. At around 1290px it broke as
          "Five years of building / things", leaving a one-word orphan line
          above the accent. `text-wrap: balance` splits it evenly instead and
          keeps doing so at every width; the accent phrase is a block so it
          always starts its own line regardless.
        -->
        <h1 class="about-hero__title font-display headline-lg leading-[1.05] max-w-4xl">
          <span class="block">Five years of building things</span>
          <span class="block italic text-accent">people have to use.</span>
        </h1>

        <div class="about-lede">
          <p>
            I&rsquo;m Jan Kevin Cadampog — most people just say JKC. I build full-stack web applications from Cebu
            City, currently as a Software Engineer at OSL International, working across .NET on the back and Angular
            on the front.
          </p>
          <p>
            I started in 2021 writing .NET MVC against SQL Server for a pawnshop chain, spent two years at Fujitsu on
            enterprise healthcare systems where the software had to be right because clinicians were depending on it,
            and now build web apps end to end — the API, the UI, and the integration work in between.
          </p>
          <p>
            What I keep coming back to is the unglamorous middle of software: the systems already in production, the
            ones with real users and real history, where the interesting problem is usually not the feature but
            everything it has to survive.
          </p>
        </div>
      </div>
    </section>

    <section class="about-principles">
      <div class="container-edge">
        <p class="eyebrow mb-12">How I work</p>
        <div class="about-principles__grid">
          <article v-for="item in principles" :key="item.title">
            <h2>{{ item.title }}</h2>
            <p>{{ item.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!--
      Moved here from the home page. It sat between Experience and Tech Stack,
      which is the exact stretch someone scanning for whether to hire me reads
      - so it interrupted the one job that page has. Here it is the point
      rather than an interruption.
    -->
    <FamilySection />

    <section class="about-outro">
      <div class="container-edge">
        <h2 class="font-display text-3xl md:text-4xl leading-tight max-w-2xl">
          That&rsquo;s the long version.<br />
          <span class="italic text-accent">Here&rsquo;s the work.</span>
        </h2>
        <div class="about-outro__links">
          <NuxtLink to="/#work" class="about-link">
            Selected work
            <span aria-hidden="true">&rarr;</span>
          </NuxtLink>
          <NuxtLink to="/#contact" class="about-link">
            Get in touch
            <span aria-hidden="true">&rarr;</span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
/*
 * Enough top padding to clear the fixed site header, which floats over the
 * page rather than taking space in it.
 */
.about-hero {
  padding-block: 9rem 4rem;
}

@media (min-width: 768px) {
  .about-hero {
    padding-block: 12rem 5rem;
  }
}

.about-hero__title {
  text-wrap: balance;
}

.about-lede {
  display: grid;
  gap: 1.5rem;
  max-width: 62ch;
  margin-top: 3rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: var(--color-muted);
  text-wrap: pretty;
}

.about-principles {
  padding-block: 4rem 5rem;
  border-block-start: 1px solid rgba(255, 255, 255, 0.08);
}

.about-principles__grid {
  display: grid;
  gap: 3rem;
}

@media (min-width: 900px) {
  .about-principles__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 3.5rem;
  }
}

.about-principles__grid h2 {
  margin-block-end: 0.875rem;
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--color-fg);
}

.about-principles__grid p {
  line-height: 1.7;
  color: var(--color-muted);
  text-wrap: pretty;
}

.about-outro {
  padding-block: 5rem 7rem;
  border-block-start: 1px solid rgba(255, 255, 255, 0.08);
}

.about-outro__links {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  margin-top: 2.5rem;
}

.about-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 14px;
  color: var(--color-muted);
  transition:
    color 240ms var(--ease-out-expo),
    gap 240ms var(--ease-out-expo);
}

.about-link:hover {
  color: var(--color-accent);
  gap: 0.85rem;
}
</style>

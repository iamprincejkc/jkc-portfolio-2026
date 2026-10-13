<script setup lang="ts">
/**
 * The long version.
 *
 * The home page carries a three-line summary and a link here; this page is
 * where the rest of it lives - where I have worked, what I bring, and family.
 *
 * Written to be read by a recruiter in under a minute: real titles, dates and
 * project names, plain sentences, and nothing the CV would contradict.
 *
 * Splitting it this way is the point. A home page has to answer "can this
 * person build the thing" in about a screen; a biography does not fit inside
 * that and was quietly making the answer slower to reach.
 */
const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')

const DESCRIPTION =
  'Jan Kevin Cadampog is a full-stack .NET and Angular developer in Cebu City, Philippines, with five years across RD Pawnshop, Fujitsu and OSL International.'

useHead({ title: 'About — Jan Kevin Cadampog' })

useSeoMeta({
  description: DESCRIPTION,
  ogTitle: 'About — Jan Kevin Cadampog',
  ogDescription: DESCRIPTION,
  ogUrl: `${siteUrl}/about`,
  twitterTitle: 'About — Jan Kevin Cadampog',
  twitterDescription: DESCRIPTION,
})

/**
 * What a hiring manager is checking for, each backed by something on the
 * record: a role, a project, or the stack the skills section lists. Keep it
 * that way - a claim here should be one the work or the CV can show.
 */
const principles = [
  {
    title: 'Systems businesses run on',
    body: 'Most of my work is on software that companies use every day: internal tools for a pawnshop chain, a hospital records system, and vehicle export platforms for Japanese clients. I am used to large codebases that already have users, and to changing them carefully.',
  },
  {
    title: 'Production support',
    body: 'At Fujitsu I developed and tested features for each release, handled production support and change requests, and delivered critical work on my own timelines.',
  },
  {
    title: 'Front end to database',
    body: '.NET and C# on the server, Angular and TypeScript in the browser, SQL Server and MongoDB for data. I can take a feature from the database to the screen without handing it off.',
  },
]
</script>

<template>
  <main>
    <section class="about-hero">
      <div class="container-edge">
        <p class="eyebrow mb-6">About</p>
        <!--
          No hard <br /> inside either line: `text-wrap: balance` splits them
          evenly at every width, and the accent phrase is a block so it always
          starts its own line.
        -->
        <h1 class="about-hero__title font-display headline-lg leading-[1.05] max-w-4xl">
          <span class="block">I build web apps</span>
          <span class="block italic text-accent">with .NET and Angular.</span>
        </h1>

        <div class="about-lede">
          <p>
            I&rsquo;m Jan Kevin Cadampog, or JKC. I&rsquo;m a full-stack developer in Cebu City, Philippines, and a
            Software Engineer at OSL International, where I build and maintain web platforms for companies in Japan,
            including IBC Auto and Jet Logistics. I work on both sides: the .NET APIs and the Angular front ends.
          </p>
          <p>
            I started in 2021 as a programmer at RD Pawnshop, building .NET MVC applications on SQL Server. From 2023
            to 2025 I was an Application System Engineer at Fujitsu, working on HOPE LifeMark-HX, an electronic
            medical record system for hospitals. I joined OSL International in 2025.
          </p>
          <p>
            I also built 360&deg;FS and 3QV, the 360&deg; viewer and photo carousel plugins made for Jet Logistics and
            IBC Auto. In my own time I make the tools on this site: a QR code generator, a searchable library of n8n
            workflows, and a directory of public APIs.
          </p>
        </div>
      </div>
    </section>

    <section class="about-principles">
      <div class="container-edge">
        <p class="eyebrow mb-12">What I bring</p>
        <div class="about-principles__grid">
          <article v-for="item in principles" :key="item.title">
            <h2>{{ item.title }}</h2>
            <p>{{ item.body }}</p>
          </article>
        </div>
      </div>
    </section>

    <!--
      Moved here from the home page, where it sat between Experience and Tech
      Stack - the stretch someone deciding whether to hire me actually reads.
    -->
    <FamilySection />

    <section class="about-outro">
      <div class="container-edge">
        <h2 class="font-display text-3xl md:text-4xl leading-tight max-w-2xl">
          See the projects,<br />
          <span class="italic text-accent">or get in touch.</span>
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

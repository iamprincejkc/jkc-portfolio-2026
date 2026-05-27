<script setup lang="ts">
const roles = [
  {
    company: 'OSL International Inc.',
    title: 'Software Engineer',
    period: '2025 — Present',
    blurb:
      'Building full-stack web apps with .NET and Angular. Frontend UI, backend APIs, and system integration end-to-end.',
  },
  {
    company: 'Fujitsu',
    title: 'Application System Engineer / Consultant',
    period: '2023 — 2025',
    blurb:
      'Developed and tested enterprise healthcare applications. Handled production support, change requests, and critical projects on independent timelines.',
  },
  {
    company: 'RD Pawnshop',
    title: 'Programmer',
    period: '2021 — 2023',
    blurb:
      'Built and maintained .NET MVC applications backed by SQL Server. Code reviews, bug fixing, and shipping features with Git.',
  },
]
</script>

<template>
  <section id="experience" class="py-24 md:py-32 border-t border-border-muted">
    <div class="container-edge">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div class="lg:col-span-4">
          <p class="eyebrow mb-4">Experience</p>
          <h3 class="font-display text-3xl md:text-4xl leading-tight">
            Five years shipping<br />
            <span class="italic text-accent">enterprise software</span>
          </h3>
        </div>

        <ol class="lg:col-span-8 space-y-10">
          <li
            v-for="r in roles"
            :key="r.company"
            class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 pb-10 border-b border-border-muted last:border-0"
          >
            <div>
              <p class="text-sm text-text-muted tabular-nums">{{ r.period }}</p>
              <p class="text-lg mt-1">{{ r.company }}</p>
            </div>
            <div class="md:col-span-2">
              <h4 class="font-display italic text-2xl mb-3">{{ r.title }}</h4>
              <p class="text-text-muted leading-relaxed max-w-prose">
                {{ r.blurb }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

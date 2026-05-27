<script setup lang="ts">
const skills = [
  { name: '.NET', icon: '/images/skills-dotnet.svg' },
  { name: 'C#', icon: '/images/skills-csharp.svg' },
  { name: 'Angular', icon: '/images/skills-angular.svg' },
  { name: 'TypeScript', icon: '/images/skills-typescript.svg' },
  { name: 'Tailwind CSS', icon: '/images/skills-tailwind-css.svg' },
  { name: 'JavaScript', icon: '/images/skills-javascript.svg' },
  { name: 'HTML', icon: '/images/skills-html.svg' },
  { name: 'CSS', icon: '/images/skills-css.svg' },
  { name: 'SQL Server', icon: '/images/skills-sqlserver.svg' },
  { name: 'MongoDB', icon: '/images/skills-mongodb.svg' },
  { name: 'Git', icon: '/images/skills-git.svg' },
]
</script>

<template>
  <section class="py-20 md:py-28 border-t border-border-muted overflow-hidden">
    <div class="container-edge mb-10">
      <p class="eyebrow mb-3">Tech stack</p>
      <h3 class="font-display text-2xl md:text-3xl">
        Tools I reach for, daily.
      </h3>
    </div>

    <!-- Two opposing marquees of skill chips -->
    <div class="marquee" style="--duration: 40s">
      <div class="marquee__track">
        <div
          v-for="(s, i) in [...skills, ...skills]"
          :key="`a-${i}`"
          class="flex items-center gap-3 px-6 py-3 mr-4 border border-border-muted rounded-full whitespace-nowrap"
        >
          <img :src="s.icon" :alt="s.name" class="w-6 h-6" />
          <span class="text-base">{{ s.name }}</span>
        </div>
      </div>
      <div class="marquee__track" aria-hidden="true">
        <div
          v-for="(s, i) in [...skills, ...skills]"
          :key="`b-${i}`"
          class="flex items-center gap-3 px-6 py-3 mr-4 border border-border-muted rounded-full whitespace-nowrap"
        >
          <img :src="s.icon" :alt="s.name" class="w-6 h-6" />
          <span class="text-base">{{ s.name }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

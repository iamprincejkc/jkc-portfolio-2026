<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-border-muted py-10">
    <div class="container-edge grid grid-cols-2 md:grid-cols-4 gap-6 items-end">
      <div>
        <p class="font-display text-3xl italic">JKC</p>
        <p class="text-xs text-text-muted mt-1">© {{ year }} — All rights reserved</p>
      </div>

      <div class="text-sm">
        <p class="eyebrow mb-2">Menu</p>
        <ul class="space-y-1">
          <li><a href="#work" class="tap-safe hover:text-accent transition-colors">Work</a></li>
          <li><a href="#about" class="tap-safe hover:text-accent transition-colors">About</a></li>
          <li><a href="#contact" class="tap-safe hover:text-accent transition-colors">Contact</a></li>
        </ul>
      </div>

      <div class="text-sm">
        <p class="eyebrow mb-2">Social</p>
        <ul class="space-y-1">
          <li><a href="https://github.com/iamprincejkc" target="_blank" rel="noopener" class="tap-safe hover:text-accent transition-colors">GitHub</a></li>
          <li><a href="https://ph.linkedin.com/in/iamprincejkc" target="_blank" rel="noopener" class="tap-safe hover:text-accent transition-colors">LinkedIn</a></li>
          <li><a href="https://dev.to/iamprincejkc" target="_blank" rel="noopener" class="tap-safe hover:text-accent transition-colors">Dev.to</a></li>
        </ul>
      </div>

      <div class="text-sm md:text-right col-span-2 md:col-span-1">
        <p class="eyebrow mb-2">Contact</p>
        <a href="mailto:princejankevin+profile@gmail.com" class="tap-safe hover:text-accent transition-colors break-all">
          princejankevin@gmail.com
        </a>
      </div>
    </div>
  </footer>
</template>

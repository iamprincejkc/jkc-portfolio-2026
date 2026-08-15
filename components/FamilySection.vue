<script setup lang="ts">
const parents = [
  { name: 'Joel',  relation: 'Father',  image: '/images/p.jpg' },
  { name: 'Belen', relation: 'Mother',  image: '/images/m.jpg' },
]

const children = [
  { name: 'Kareen', relation: 'Sister',  image: '/images/k1.jpg' },
  { name: 'Jan',    relation: 'Me',      image: '/images/me.jpg', isMe: true },
  { name: 'Jepte',  relation: 'Brother', image: '/images/j.jpg'  },
  { name: 'Kim',    relation: 'Sister',  image: '/images/k2.jpg' },
]
</script>

<template>
  <section id="family" class="py-24 md:py-32 border-t border-border-muted">
    <div class="container-edge">
      <div class="max-w-2xl mb-16">
        <p class="eyebrow mb-3">Family</p>
        <h2 class="font-display text-3xl md:text-4xl leading-tight">
          The people behind the<br />
          <span class="italic text-accent">person behind the code.</span>
        </h2>
      </div>

      <div class="family-tree">
        <!-- Parents row -->
        <div class="family-tree__row family-tree__row--parents">
          <div
            v-for="(p, i) in parents"
            :key="p.name"
            class="family-member"
          >
            <div class="family-member__photo">
              <NuxtImg :src="p.image" :alt="p.name" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
            <p class="family-member__name">{{ p.name }}</p>
            <p class="family-member__relation">{{ p.relation }}</p>
            <span v-if="i === 0" class="family-tree__married" aria-hidden="true"></span>
          </div>
        </div>

        <!-- Vertical connector down to children -->
        <div class="family-tree__connector" aria-hidden="true"></div>

        <!-- Children row -->
        <div class="family-tree__row family-tree__row--children">
          <div
            v-for="c in children"
            :key="c.name"
            class="family-member"
            :class="{ 'family-member--me': c.isMe }"
          >
            <div class="family-member__photo">
              <NuxtImg :src="c.image" :alt="c.name" class="w-full h-full object-cover" loading="lazy" decoding="async" />
            </div>
            <p class="family-member__name">{{ c.name }}</p>
            <p class="family-member__relation">{{ c.relation }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.family-tree {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
}

.family-tree__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem 3rem;
  position: relative;
}

.family-tree__row--parents {
  gap: 2rem 6rem;
}

/* Horizontal line between the two parents (the "married" link) */
.family-tree__married {
  position: absolute;
  top: 64px; /* roughly photo center */
  left: 100%;
  width: 6rem;
  height: 1px;
  background: rgba(118, 118, 118, 0.4);
}

/* Vertical connector between parents row and children row */
.family-tree__connector {
  width: 1px;
  height: 3rem;
  background: rgba(118, 118, 118, 0.4);
  margin: -1rem 0;
}

/* Horizontal line above children row showing they share parents.
   Drawn via ::before, spanning the row above the children's photos. */
.family-tree__row--children::before {
  content: '';
  position: absolute;
  top: -1.5rem;
  left: 10%;
  right: 10%;
  height: 1px;
  background: rgba(118, 118, 118, 0.4);
}

/* Short vertical drop from the horizontal line to each child */
.family-tree__row--children .family-member::before {
  content: '';
  position: absolute;
  top: -1.5rem;
  left: 50%;
  width: 1px;
  height: 1.5rem;
  background: rgba(118, 118, 118, 0.4);
}

.family-member {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 9rem;
}

.family-member__photo {
  width: 7rem;
  height: 7rem;
  border-radius: 9999px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.06);
  background: #1a1a1a;
  transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1),
              border-color 0.3s;
}

.family-member:hover .family-member__photo {
  transform: scale(1.06);
  border-color: var(--color-accent);
}

.family-member--me .family-member__photo {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 4px rgba(232, 212, 160, 0.15);
}

.family-member__name {
  margin-top: 0.75rem;
  font-family: 'Melodrama', 'General Sans', serif;
  font-style: italic;
  font-size: 1.25rem;
}

.family-member__relation {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-top: 0.125rem;
}

/* Mobile: stack everything cleaner, hide tree lines that don't make sense */
@media (max-width: 640px) {
  .family-tree__row {
    gap: 1.5rem 1.5rem;
  }
  .family-tree__row--parents {
    gap: 1.5rem 3rem;
  }
  .family-tree__married,
  .family-tree__row--children::before,
  .family-tree__row--children .family-member::before {
    display: none;
  }
  .family-member {
    width: 7rem;
  }
  .family-member__photo {
    width: 5.5rem;
    height: 5.5rem;
  }
}
</style>

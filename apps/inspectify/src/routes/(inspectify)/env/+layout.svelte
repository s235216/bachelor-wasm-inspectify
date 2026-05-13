<script lang="ts">
  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="relative grid grid-rows-[1fr_auto]">
  <main class="relative grid h-full">
    <div class="absolute inset-0 grid">
      {@render children?.()}
    </div>
  </main>
</div>

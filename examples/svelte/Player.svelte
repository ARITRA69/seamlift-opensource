<script lang="ts">
  import { onMount } from "svelte";
  import type { SeamPlayerElement } from "seamplayer/element";
  import type { SeamChapter } from "seamplayer/core";
  import "seamplayer/styles.css";

  let { src, poster, title = "Film", chapters = [] }: {
    src: string; poster?: string; title?: string; chapters?: SeamChapter[];
  } = $props();
  let player = $state<SeamPlayerElement>();
  onMount(() => { void import("seamplayer/element"); });
  $effect(() => { if (player) player.chapters = chapters; });
</script>

<seam-player class="sp" bind:this={player} {src} {poster} {title} />

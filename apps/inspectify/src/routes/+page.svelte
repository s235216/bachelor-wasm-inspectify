<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { ce_shell } from '$lib/api';

  if (browser) {
    goto(`/env/${ce_shell.ANALYSIS[0]}`, { replaceState: true });
  }
</script>

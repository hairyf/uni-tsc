<template>
  <div></div>
</template>

<script lang="ts">
  import { defineComponent, defineProps } from 'vue'
  const a: string = 'awdwada'
  export default defineComponent({ name: '' })
</script>
<script lang="ts" setup>
  const props = defineProps<{
    value: string
  }>()
</script>

<style lang="scss" scoped></style>

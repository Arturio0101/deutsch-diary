export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    return
  }

  const { $supabase } = useNuxtApp()
  const { data } = await $supabase.auth.getSession()

  if (!data.session) {
    return navigateTo('/login')
  }
})
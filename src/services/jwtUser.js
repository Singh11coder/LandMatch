export function jwtUser() {
  try { return JSON.parse(atob(localStorage.getItem('lw_token').split('.')[1])) } catch { return null }
}

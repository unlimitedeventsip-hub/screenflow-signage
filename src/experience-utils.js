export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function httpsLink(value) {
  try { const url = new URL(String(value || '')); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function bucharestNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Bucharest', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(date);
  const get = type => parts.find(x => x.type === type)?.value;
  return {day:({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7})[get('weekday')], time:`${get('hour')}:${get('minute')}`};
}
export function isScheduled(item, date = new Date()) {
  const now = date.getTime();
  if (item.starts_at && Date.parse(item.starts_at) > now) return false;
  if (item.ends_at && Date.parse(item.ends_at) <= now) return false;
  const {day,time} = bucharestNow(date), days = item.weekdays || [1,2,3,4,5,6,7];
  const start = String(item.daily_start || '').slice(0,5), end = String(item.daily_end || '').slice(0,5);
  if (!start || !end || start === end) return days.includes(day);
  return start < end ? days.includes(day) && time >= start && time < end :
    (time >= start && days.includes(day)) || (time < end && days.includes(day === 1 ? 7 : day - 1));
}
export function localReservationDate(value) {
  // Keep the local wall-clock string. Conversion into Europe/Bucharest belongs
  // to the server/database, never the laptop's or phone's timezone.
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value.replace('T',' ') + ':00' : '';
}
export async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, {...options,signal:controller.signal}); } finally { clearTimeout(timer); }
}

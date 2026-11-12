// Admin UI for video sound and background music, configured per playlist.
export function renderAudioView({ state, heading, safe, pubUrl }) {
  const selected = state.playlists.find(p => p.id === state.selectedPlaylist);
  const menu = state.playlists.map(p => `<button class="playlist-option ${selected?.id === p.id ? 'selected' : ''}" data-action="select-playlist" data-id="${safe(p.id)}"><span>♫</span><div><strong>${safe(p.name)}</strong><small>Setări audio individuale</small></div></button>`).join('');
  const tracks = state.tracks.map(t => `<div class="audio-track">
    <div><strong>${safe(t.name)}</strong><small>MP3</small></div>
    <audio controls preload="none" src="${safe(pubUrl(t.storage_path))}"></audio>
    <button type="button" class="btn small subtle" data-action="delete-audio" data-id="${safe(t.id)}">Șterge</button>
  </div>`).join('');
  const header = heading('CONTROL AUDIO', 'Sunet & muzică', 'Sunet original în reclamele video și muzică de fundal în timpul fotografiilor, pentru fiecare playlist.');
  if (!state.audioReady) {
    return header + `<section class="panel"><h2>Funcția audio așteaptă activarea bazei de date</h2>
      <p>Verifică migrarea <code>supabase/upgrade_v3_audio.sql</code>. ${safe(state.audioError)}</p></section>`;
  }
  const settings = selected ? `
    <div class="panel-head"><h2>${safe(selected.name)}</h2></div>
    <form data-form="audio-settings" data-id="${safe(selected.id)}" class="audio-form">
      <div class="audio-group">
        <h3>Sunetul reclamelor video</h3>
        <label class="audio-switch"><input type="checkbox" name="video_audio_enabled" ${selected.video_audio_enabled ? 'checked' : ''}> Activează sunetul original al reclamelor MP4</label>
        <label>Volum reclame video (0–100%)<input name="video_volume" type="number" min="0" max="100" step="5" value="${Number(selected.video_volume ?? 35)}" required></label>
      </div>
      <div class="audio-group">
        <h3>Muzică de fundal pentru imagini</h3>
        <label class="audio-switch"><input type="checkbox" name="background_audio_enabled" ${selected.background_audio_enabled ? 'checked' : ''}> Muzică în timpul fotografiilor; pauză automată la video</label>
        <label>Alege piesa
          <select name="background_track_id"><option value="">Fără piesă</option>${state.tracks.map(t => `<option value="${safe(t.id)}" ${selected.background_track_id === t.id ? 'selected' : ''}>${safe(t.name)}</option>`).join('')}</select>
        </label>
        <label>Volum muzică (0–100%)<input name="background_volume" type="number" min="0" max="100" step="5" value="${Number(selected.background_volume ?? 25)}" required></label>
      </div>
      <button class="btn primary" type="submit">Salvează setările de sunet</button>
      <p class="audio-hint">Unele televizoare cer apăsarea OK pentru pornirea sunetului. Volumul real depinde și de setările fizice ale televizorului.</p>
    </form>
  ` : '<p>Selectează un playlist pentru a-i configura sunetul.</p>';

  return header + `<div class="audio-layout">
    <section class="panel"><div class="panel-head"><h2>Playlisturi</h2></div>
      <div class="playlist-menu">${menu || '<p>Creează mai întâi un playlist.</p>'}</div>
    </section>
    <section class="panel audio-settings-panel">${settings}</section>
  </div>
  <section class="panel audio-library">
    <div class="panel-head"><h2>Bibliotecă muzicală</h2><span>MP3 · max. 20 MB</span></div>
    <form data-form="audio-upload" class="upload-form">
      <input type="text" name="title" required maxlength="150" placeholder="Numele piesei sau ambientului">
      <input type="file" name="file" accept=".mp3,audio/mpeg,audio/mp3" required>
      <button type="submit" class="btn primary">Încarcă muzica</button>
    </form>
    <p class="audio-hint">Folosește doar piese pentru care ai drepturi de difuzare în locație. Muzica se repetă pe imagini și se oprește în timpul reclamelor video.</p>
    <div class="audio-tracks">${tracks || '<p>Nicio piesă încărcată.</p>'}</div>
  </section>`;
}

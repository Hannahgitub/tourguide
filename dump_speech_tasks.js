const fs = require('fs');

const content = fs.readFileSync('data.js', 'utf8');
const match = content.match(/window\.data\s*=\s*(\{[\s\S]*?\});?\s*$/);

if (match) {
  try {
    const data = JSON.parse(match[1]);
    const speeches = data.speeches || [];
    const list = speeches.map(s => ({
      name: s.name || s.id,
      category: s.category || '',
      sections: (s.sections || []).map((sec, idx) => ({
        idx: idx,
        title: sec.title || '',
        text: (sec.en || '').replace(/<[^>]+>/g, '').replace(/^(English|Chinese)[:：/\s]*/i, '').trim()
      }))
    }));
    fs.writeFileSync('speech_audio_tasks.json', JSON.stringify(list, null, 2), 'utf8');
    console.log(`Successfully exported ${list.length} speeches to speech_audio_tasks.json`);
  } catch (e) {
    console.error('JSON parse error:', e.message);
  }
} else {
  console.error('Could not match window.data');
}

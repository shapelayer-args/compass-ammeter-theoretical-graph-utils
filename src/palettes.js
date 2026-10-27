/** The seminar preset uses theme.typ's ivory/slate/clay palette.
 * Dark mode adapts the source's inverse slate-950 / ivory-light slide colors. */
export const PALETTE_NAMES={default:'기본 · 바이올렛',seminar:'세미나 · 아이보리 & 클레이'};
const DEFAULT={
 light:{bg:'#f3f2f5',surface:'#ffffff',plot:'#f6f5f8',ink:'#25232a',muted:'#74717d',line:'#e5e2e9',grid:'#e6e3eb',axis:'#b4afbd',curve:'#67508c',blue:'#556bba',green:'#348575',orange:'#c27543',accent:'#eae0fa','accent-ink':'#513b72',control:'#eeecf2'},
 dark:{bg:'#17161b',surface:'#222127',plot:'#29272f',ink:'#eeebf3',muted:'#b0aab9',line:'#3a3641',grid:'#39353f',axis:'#706879',curve:'#cbb0ef',blue:'#a5b5ff',green:'#81ccba',orange:'#f3b181',accent:'#493858','accent-ink':'#eddaff',control:'#302d37'}
};
const SEMINAR={
 light:{bg:'#faf9f5',surface:'#f0eee6',plot:'#faf9f5',ink:'#141413',muted:'#73726c',line:'#d1cfc5',grid:'#e8e6dc',axis:'#b0aea5',curve:'#3d3d3a',blue:'#6a9bcc',green:'#788c5d',orange:'#c6613f',accent:'#f5e4dc','accent-ink':'#c6613f',control:'#e8e6dc'},
 dark:{bg:'#141413',surface:'#262624',plot:'#1a1918',ink:'#faf9f5',muted:'#b0aea5',line:'#3d3d3a',grid:'#262624',axis:'#73726c',curve:'#d1cfc5',blue:'#6a9bcc',green:'#bcd1ca',orange:'#d97757',accent:'#47342b','accent-ink':'#ebcece',control:'#3d3d3a'}
};
export function paletteFor(name='default',theme='light') {
 return (name==='seminar'?SEMINAR:DEFAULT)[theme==='dark'?'dark':'light'];
}

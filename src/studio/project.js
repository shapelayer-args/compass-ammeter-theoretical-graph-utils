import { validateFrames } from './model.js';

export const PROJECT_FORMAT = 'compass-ammeter-project';
export const PROJECT_VERSION = 1;

/** Validate a complete document before changing the current workspace. */
export function validateProject(value) {
  if (!value || value.format !== PROJECT_FORMAT || value.version !== PROJECT_VERSION) {
    throw Error('지원하는 나침반 전류계 프로젝트 파일이 아닙니다.');
  }
  const state = validateFrames([{ time: 0, state: value.state }])[0].state;
  const frames = validateFrames(value.frames);
  const s = value.settings;
  if (!s || !['angle', 'current'].includes(s.axisMode) || !['system', 'light', 'dark'].includes(s.theme)
      || !['smooth', 'linear'].includes(s.easing) || typeof s.loop !== 'boolean'
      || !Number.isFinite(value.playhead) || value.playhead < 0 || value.playhead > 300) {
    throw Error('프로젝트 설정이 올바르지 않습니다.');
  }
  const workspace=s.workspace??'graphs';
  if(!['graphs','coil'].includes(workspace)) throw Error('지원하지 않는 화면입니다.');
  const coil=s.coil??{showCurrent:true,showField:true,showCompass:true};
  if(!coil||['showCurrent','showField','showCompass'].some(k=>typeof coil[k]!=='boolean')) throw Error('코일 표시 설정이 올바르지 않습니다.');
  const layout=s.layout??{panelClosed:false,timelineHidden:false,presenting:false};
  if(!layout||['panelClosed','timelineHidden','presenting'].some(k=>typeof layout[k]!=='boolean')) throw Error('화면 배치 설정이 올바르지 않습니다.');
  return {
    format: PROJECT_FORMAT, version: PROJECT_VERSION,
    name: String(value.name || '나침반 실험').trim().slice(0, 60) || '나침반 실험',
    state, frames, playhead: value.playhead,
    settings: { axisMode: s.axisMode, theme: s.theme, easing: s.easing, loop: s.loop, workspace, layout:{panelClosed:layout.panelClosed,timelineHidden:layout.timelineHidden,presenting:layout.presenting}, coil: {showCurrent:coil.showCurrent,showField:coil.showField,showCompass:coil.showCompass} }
  };
}

/** Duplicate poses mark holds; smooth interpolation only moves between poses. */
export function createDemoProject() {
  const frames = [];
  let time = 0;
  for (const [index, current] of [0, 50, 100, 150, 250, 500].entries()) {
    if (index) time += .5;
    const state = { current, earth: 1, points: [{ id: 1, i: current, color: 'var(--blue)' }] };
    frames.push({ time, name: `${current} mA · 도착`, state });
    time += index === 5 ? 2 : 1;
    frames.push({ time, name: `${current} mA · 대기 끝`, state: structuredClone(state) });
  }
  frames.push({ time: time + .5, name: '0 mA · 처음으로', state: structuredClone(frames[0].state) });
  return validateProject({
    format: PROJECT_FORMAT, version: PROJECT_VERSION, name: '전류 단계 이동',
    state: structuredClone(frames[0].state), frames, playhead: 0,
    settings: { axisMode: 'angle', theme: 'system', easing: 'smooth', loop: true }
  });
}

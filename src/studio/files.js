import { esc } from '../utils.js';
import { createDemoProject, validateProject } from './project.js';

const STORAGE = 'field-lab-presets-v1';
const DEMO = 'demo-current-steps';

export function installFiles({ $, capture, open, isBusy }) {
  let presets = [];
  let downloadUrl = null;
  const status = text => { $('file-status').textContent = text; };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (!Array.isArray(saved) || saved.length > 20) throw Error();
    presets = saved.map(p => ({ id: String(p.id), project: validateProject(p.project) }));
  } catch { status('저장된 프리셋을 읽지 못했습니다. 프로젝트 파일은 열 수 있습니다.'); }

  function render(selected = DEMO) {
    $('preset-list').innerHTML = `<option value="${DEMO}">데모 · 전류 단계 이동</option>`
      + presets.map(p => `<option value="${esc(p.id)}">${esc(p.project.name)}</option>`).join('');
    $('preset-list').value = selected;
    $('preset-delete').disabled = selected === DEMO;
  }
  function persist(next) {
    localStorage.setItem(STORAGE, JSON.stringify(next));
    presets = next;
  }
  function load(project) {
    if (isBusy()) return;
    const validated = validateProject(project);
    open(validated);
    $('project-name').value = validated.name;
    status(`${validated.name}을 열었습니다.`);
  }
  $('project-open').addEventListener('click', () => {
    if (!isBusy()) $('project-file').click();
  });
  $('project-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isBusy()) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('10 MB 이하의 프로젝트 파일을 선택하세요.');
      const project = validateProject(JSON.parse(await file.text()));
      load(project);
    } catch (error) { status(`파일을 열지 못했습니다. ${error.message}`); }
  });
  function openDemo() {
    try { load(createDemoProject()); } catch (error) { status(error.message); }
  }
  $('project-demo').addEventListener('click', openDemo);
  $('keyframe-demo').addEventListener('click', openDemo);
  $('project-save').addEventListener('click', () => {
    if (isBusy()) return;
    try {
      const project = validateProject(capture($('project-name').value));
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}.compass.json`;
      document.body.append(link); link.click(); link.remove();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = url;
      status('현재 설정과 타임라인을 프로젝트 파일로 저장했습니다.');
    } catch (error) { status(`저장하지 못했습니다. ${error.message}`); }
  });
  $('preset-save').addEventListener('click', () => {
    if (isBusy()) return;
    const name = $('project-name').value.trim();
    if (!name) { status('프리셋 이름을 입력하세요.'); $('project-name').focus(); return; }
    try {
      const project = validateProject(capture(name));
      const existing = presets.find(p => p.project.name === project.name);
      if (!existing && presets.length >= 20) throw Error('프리셋은 최대 20개까지 저장할 수 있습니다.');
      const id = existing?.id || crypto.randomUUID();
      const next = existing ? presets.map(p => p.id === id ? { id, project } : p) : [...presets, { id, project }];
      persist(next); render(id);
      status(existing ? '같은 이름의 프리셋을 갱신했습니다.' : '현재 설정과 타임라인을 이 브라우저에 프리셋으로 저장했습니다.');
    } catch (error) { status(`프리셋을 저장하지 못했습니다. ${error.message}`); }
  });
  $('preset-list').addEventListener('change', () => {
    $('preset-delete').disabled = $('preset-list').value === DEMO;
  });
  $('preset-open').addEventListener('click', () => {
    try {
      const id = $('preset-list').value;
      const project = id === DEMO ? createDemoProject() : presets.find(p => p.id === id)?.project;
      if (project) load(project);
    } catch (error) { status(error.message); }
  });
  $('preset-delete').addEventListener('click', () => {
    if (isBusy() || $('preset-list').value === DEMO) return;
    try {
      persist(presets.filter(p => p.id !== $('preset-list').value));
      render(); status('프리셋을 삭제했습니다.');
    } catch (error) { status(`프리셋을 삭제하지 못했습니다. ${error.message}`); }
  });
  render();
}

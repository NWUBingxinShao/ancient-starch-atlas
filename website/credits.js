/* Rolling credits adapted from the supplied player; a single acknowledgements experience. */
(() => {
  'use strict';
  const db = window.STARCH_ATLAS_LITERATURE;
  const $ = id => document.getElementById(id);
  const node = (tag, cls, text) => {
    const result = document.createElement(tag);
    if (cls) result.className = cls;
    if (text !== undefined) result.textContent = String(text);
    return result;
  };
  let lang = 'zh', playing = false, frame = 0, last = null;
  let position = 0;
  const viewport = $('credits-viewport'), track = $('credits-track');
  const speed = $('credits-speed'), status = $('credits-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stroke = new Intl.Collator('zh-Hans-CN-u-co-stroke');
  const alphabet = new Intl.Collator('en', {sensitivity: 'base'});
  const isZH = name => /[\u3400-\u9fff]/.test(name);
  const surname = name => name.includes(',') ? name.split(',')[0] : name.trim().split(/\s+/).at(-1);
  const compareNames = (a, b) => {
    if (isZH(a) !== isZH(b)) return isZH(a) ? -1 : 1;
    return isZH(a) ? stroke.compare(a, b) : alphabet.compare(surname(a), surname(b)) || alphabet.compare(a, b);
  };
  const roster = [...new Set(db?.roster || [])].sort(compareNames);
  const tr = (zh, en) => lang === 'zh' ? zh : en;
  const fmt = n => Number(n).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');
  const maxScroll = () => Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const atEnd = () => maxScroll() > 0 && viewport.scrollTop >= maxScroll() - 1;
  try {
    lang = localStorage.getItem('atlas-language') === 'en' ? 'en' : 'zh';
    const percent = Number(localStorage.getItem('atlas-font-percent'));
    if ([90, 100, 115, 130, 150].includes(percent)) document.documentElement.style.setProperty('--font-scale', String(percent / 100));
  } catch {}

  const chapters = [
    ['preface', '致谢序言', 'Preface'],
    ['authors', '全部文献作者', 'Authors of the literature'],
    ['team', '数据库建设与技术服务', 'Database development & technical services'],
    ['support', '机构与项目支持', 'Institutional & project support'],
    ['copyright', '版权与使用说明', 'Copyright & use'],
    ['contact', '数据勘误与联系方式', 'Corrections & contact'],
    ['version', '项目版本与更新日期', 'Version & release date'],
    ['closing', '致谢终章', 'Closing credits'],
  ];

  function chapterTop(id) {
    const section = $('roll-' + id);
    return section ? Math.max(0, Math.min(maxScroll(), section.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 60)) : 0;
  }
  function labelButton() {
    $('credits-play-label').textContent = playing ? tr('暂停', 'Pause') : atEnd() ? tr('重新播放', 'Replay') : tr('播放致谢', 'Play');
    $('credits-play-icon').textContent = playing ? 'Ⅱ' : '▶';
    $('credits-play').setAttribute('aria-pressed', String(playing));
  }
  function progress() {
    const max = maxScroll(), percentage = max ? Math.min(100, Math.round(viewport.scrollTop / max * 100)) : 0;
    $('credits-progress').value = percentage;
    $('credits-progress-text').textContent = percentage + '%';
    let current = chapters[0][0];
    for (const [id] of chapters) if (chapterTop(id) <= viewport.scrollTop + 2) current = id;
    $('credits-chapter').value = current;
    labelButton();
  }
  function pause(announce = true) {
    playing = false;
    cancelAnimationFrame(frame);
    frame = 0;
    last = null;
    position = viewport.scrollTop;
    labelButton();
    if (announce) status.textContent = atEnd() ? tr('致谢播放完毕', 'Credits complete') : tr('已暂停，可手动阅读', 'Paused. Scroll to read.');
  }
  function tick(now) {
    if (!playing) return;
    if (last !== null) {
      // Keep fractional pixels so slow playback also moves smoothly on integer-scroll browsers.
      position = Math.min(maxScroll(), position + Math.min(80, now - last) * 0.024 * Number(speed.value));
      viewport.scrollTop = position;
      if (position >= maxScroll()) { pause(); progress(); return; }
    }
    last = now;
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (!db) return;
    cancelAnimationFrame(frame);
    if (atEnd()) viewport.scrollTop = 0;
    position = viewport.scrollTop;
    playing = true;
    last = null;
    labelButton();
    status.textContent = tr('正在播放致谢', 'Playing credits');
    frame = requestAnimationFrame(tick);
  }
  function toggle() { playing ? pause() : play(); }
  function jump(id, keepPlaying = playing) {
    pause(false);
    viewport.scrollTop = chapterTop(id);
    position = viewport.scrollTop;
    progress();
    status.textContent = tr('已跳转：', 'Jumped to: ') + chapters.find(c => c[0] === id)?.[lang === 'zh' ? 1 : 2];
    if (keepPlaying && !atEnd()) play();
  }

  function section(id, overline) {
    const part = node('section', 'roll-section');
    part.id = 'roll-' + id;
    const chapter = chapters.find(c => c[0] === id);
    part.append(node('p', 'roll-overline', overline), node('h2', '', chapter[lang === 'zh' ? 1 : 2]), node('div', 'roll-rule'));
    track.append(part);
    return part;
  }
  function prose(part, paragraphs) {
    const copy = node('div', 'roll-prose');
    for (const text of paragraphs) copy.append(node('p', '', text));
    part.append(copy);
    return copy;
  }
  function buildScroll() {
    track.replaceChildren();
    $('credits-chapter').replaceChildren(...chapters.map(([id, zh, en]) => {
      const option = node('option', '', tr(zh, en)); option.value = id; return option;
    }));
    if (!db) { track.append(node('p', 'credits-empty', tr('致谢名单未能载入，请刷新页面。', 'Unable to load the credits. Please refresh.'))); return; }
    const preface = section('preface', 'STARCH ATLAS · WITH GRATITUDE');
    preface.querySelector('.roll-overline').remove();
    const intro = prose(preface, lang === 'zh' ? [
      '人类对植物资源的认识与利用，是理解史前生业经济、农业起源及社会发展的重要线索。淀粉粒分析及相关植物微体遗存研究，为重建古代人类的饮食结构、植物利用方式与技术活动提供了重要证据。',
      '本数据库的建立，得益于国内众多学者长期积累的研究成果。从现代植物淀粉粒形态研究，到考古遗址出土微体遗存的提取、鉴定与解释，再到石器功能、古代饮食和农业发展研究，每一项成果都为理解古代人类与植物的关系提供了新的认识。',
      '我们向本数据库所收录及引用文献的全部作者表示诚挚感谢。正是这些研究工作的不断积累，使分散于不同地区、遗址与文献中的淀粉粒研究资料得以汇集、整理和比较。',
      '同时，感谢在资料整理、学术讨论、图版核对、数据库建设及技术支持过程中提供帮助的研究者与相关人员。',
      '谨以此页，致敬所有致力于探索古代人类生活与植物利用历史的研究者。',
    ] : [
      'Human knowledge and use of plant resources offer vital clues to prehistoric subsistence, the origins of agriculture and social development. Starch analysis and related plant microremain studies provide evidence for reconstructing ancient diets, plant use and technological activities.',
      'This database draws on the accumulated work of many scholars in China. From modern plant starch morphology to the extraction, identification and interpretation of archaeological microremains, and from stone-tool function to ancient diets and agricultural development, each study advances our understanding of the relationship between people and plants.',
      'We sincerely thank all authors of the publications collected and cited in this database. Their sustained research makes it possible to bring together, organise and compare starch evidence from different regions, sites and publications.',
      'We also thank the researchers and colleagues who helped with source organisation, academic discussions, plate checking, database development and technical support.',
      'This page honours everyone working to understand ancient human life and the history of plant use.',
    ]);
    intro.append(node('p', 'roll-motto', tr('每一粒淀粉，都是通往过去的一条线索。', 'Every starch grain is a clue to the past.')));
    const names = section('authors', 'AUTHORS OF THE LITERATURE');
    names.append(node('p', 'roll-sub', tr('中文署名按姓氏笔画排列 · 英文署名按姓氏字母排列', 'Chinese names in surname stroke order · English names in surname alphabetical order')));
    const grid = node('div', 'roll-names');
    for (const name of roster) grid.append(node('div', 'roll-name' + (isZH(name) ? '' : ' latin'), name));
    names.append(grid);
    const team = section('team', 'DATABASE DEVELOPMENT & TECHNICAL SERVICES');
    team.append(node('p', 'roll-team', '马志坤　邵炳鑫'));
    const support = section('support', 'INSTITUTIONAL & PROJECT SUPPORT');
    support.classList.add('roll-support');
    support.append(node('h3', '', tr('机构支持', 'Institutional support')), node('p', '', tr('西北大学文化遗产学院', 'School of Cultural Heritage, Northwest University')),
      node('h3', '', tr('支持人员', 'Supporting colleagues')), node('p', 'support-names', tr('陈洪海教授　马健教授　翟霖林教授', 'Prof. Chen Honghai · Prof. Ma Jian · Prof. Zhai Linlin')),
      node('p', 'support-note', tr('感谢资金、平台及相关资源支持。', 'With thanks for funding, facilities and related resources.')),
      node('h3', '', tr('项目资助', 'Project funding')), node('p', '', tr('国家社会科学基金一般项目', 'National Social Science Fund of China, General Project')),
      node('p', '', '23BKG035'), node('p', '', tr('教育部哲学社会科学研究重大专项项目', 'Ministry of Education Major Special Project in Philosophy and Social Sciences')), node('p', '', '2024JZDZ058'));
    prose(section('copyright', 'COPYRIGHT & USE'), [tr('本数据库仅供学术研究、教学及非营利性学术交流使用，禁止任何形式的商业用途。所收录文献、图像及相关资料的版权归原作者或相应权利人所有，使用时请注明原始出处。', 'This database is for academic research, teaching and non-commercial scholarly exchange only. Commercial use in any form is prohibited. Copyright in the publications, images and related materials remains with the original authors or respective rights holders. Please acknowledge the original sources when using these materials.')]);
    const contact = prose(section('contact', 'CORRECTIONS & CONTACT'), [tr('如发现作者署名、文献信息、图版内容或其他数据存在错误与遗漏，欢迎联系反馈，以便及时核实与修订。', 'Please contact us about errors or omissions in author names, references, plates or other data so that we can check and correct them.')]);
    const email = node('a', '', '2021119053@stumail.nwu.edu.cn');
    email.href = 'mailto:2021119053@stumail.nwu.edu.cn';
    contact.append(email);
    const version = section('version', 'PROJECT EDITION');
    version.append(node('p', 'roll-version', 'v1.0'));
    prose(version, [tr('发布日期：2026年11月5日', 'Release date: 5 November 2026'), tr('本数据库将根据学术研究进展及用户反馈持续完善和更新。', 'This database will continue to improve with advances in research and feedback from its users.')]);
    const end = section('closing', 'EVERY GRAIN, A CLUE TO THE PAST');
    end.classList.add('roll-closing');
    end.querySelector('h2').textContent = tr('谨 致 谢 忱', 'WITH GRATITUDE');
    end.append(node('p', '', tr('致敬探索过去的每一位研究者。', 'To every researcher exploring the past.')));
    const back = node('a', '', tr('返回地图 · 继续探索 ↗', 'Back to the map ↗'));
    back.href = 'index.html#map';
    end.append(back);
  }

  function setLanguage(next) {
    const max = maxScroll(), ratio = max ? viewport.scrollTop / max : 0, resume = playing;
    pause(false); lang = next;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = tr('致谢 · 淀粉粒考古图版库', 'Acknowledgements · Starch Atlas');
    for (const el of document.querySelectorAll('[data-zh][data-en]')) el.textContent = el.dataset[lang];
    $('credits-language').textContent = tr('EN / 中', '中 / EN');
    buildScroll(); viewport.scrollTop = ratio * maxScroll(); position = viewport.scrollTop; progress();
    if (resume) play();
    try { localStorage.setItem('atlas-language', lang); } catch {}
  }

  $('credits-play').addEventListener('click', toggle);
  $('credits-restart').addEventListener('click', () => { pause(false); viewport.scrollTop = 0; play(); progress(); });
  $('credits-skip').addEventListener('click', () => {
    const next = chapters.find(([id]) => chapterTop(id) > viewport.scrollTop + 30);
    if (next) jump(next[0]);
    else { pause(false); viewport.scrollTop = maxScroll(); progress(); }
  });
  $('credits-end').addEventListener('click', () => { pause(false); viewport.scrollTop = maxScroll(); position = viewport.scrollTop; progress(); status.textContent = tr('已跳到结尾', 'Jumped to the end'); });
  $('credits-chapter').addEventListener('change', e => jump(e.target.value));
  $('credits-language').addEventListener('click', () => setLanguage(lang === 'zh' ? 'en' : 'zh'));
  viewport.addEventListener('scroll', progress, {passive: true});
  for (const event of ['wheel', 'touchstart', 'pointerdown']) viewport.addEventListener(event, () => pause(), {passive: true});
  viewport.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) pause(); });
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'SUMMARY'].includes(e.target.tagName)) return;
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); toggle(); }
  });
  motion.addEventListener('change', e => { if (e.matches) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(false); });
  window.addEventListener('resize', () => { position = viewport.scrollTop; progress(); });
  setLanguage(lang);
  if (!motion.matches) requestAnimationFrame(play);
  else status.textContent = tr('已关闭自动滚动，可手动阅读或点击播放。', 'Autoplay is off. Scroll to read or press Play.');
})();

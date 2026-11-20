// 中英文文案与即时切换
const dict = {
  zh: {
    'brand.sub': '第一人称物理台球',
    'menu.subtitle': 'CLUB No.9 · 第一人称物理台球',
    'menu.title': '九号俱乐部',
    'menu.titleEn': 'CLUB No.9',
    'menu.tagline': '灯已点上，球已摆好——今晚谁开球？',
    'menu.start': '开始游戏',
    'menu.practice': '自由练习 · 英式大台',
    'menu.guide': '操作指南',
    'menu.settings': '设置',
    'menu.mute': '静音',
    'menu.sound': '声音',
    'menu.lang': 'EN',
    'menu.hint': '鼠标瞄准 · 按住左键蓄力 · 松开出杆',
    'hud.practice': '自由练习',
    'hud.shots': '杆数',
    'hud.potted': '已进球',
    'hud.remain': '剩余',
    'hud.power': '力度',
    'hud.aim': '移动鼠标瞄准',
    'hud.shoot': '按住左键蓄力 · 松开出杆',
    'hud.keys': 'R 重新摆球 · L 逐杆回放 · H 操作指南 · M 静音 · Esc 暂停',
    'hud.replay': '逐杆回放',
    'hud.pause': '暂停',
    'hud.locked': '点击画面继续瞄准',
    'power.low': '轻推',
    'power.mid': '中杆',
    'power.high': '重杆',
    'replay.title': '逐杆回放',
    'replay.empty': '还没有可回放的击球，先打一杆吧。',
    'replay.exit': '退出回放',
    'replay.restart': '重播',
    'replay.play': '播放',
    'replay.pause': '暂停',
    'replay.shot': '第 {n} 杆',
    'replay.potted': '进球 {n}',
    'replay.duration': '{s} 秒',
    'replay.listHint': '选择一杆查看慢速回放',
    'toast.potted': '进球！',
    'toast.cuePotted': '白球落袋，已重新摆放',
    'toast.racked': '球已重新摆好',
    'toast.cleared': '清台！按 R 重新摆球',
    'toast.locked': '点击台面锁定鼠标，开始瞄准',
    'pause.title': '暂停',
    'pause.sub': '球桌在等你回来',
    'pause.resume': '继续游戏',
    'pause.rack': '重新摆球',
    'pause.menu': '返回主菜单',
    'guide.title': '操作指南',
    'guide.sub': '键鼠操作 · 一分钟上手',
    'guide.mouseTitle': '鼠标',
    'guide.mouseKey': '鼠标',
    'guide.leftKey': '左键',
    'guide.mouseAim': '移动鼠标',
    'guide.mouseAimDesc': '站在球杆后方，移动鼠标旋转球杆与视角',
    'guide.mouseCharge': '按住左键',
    'guide.mouseChargeDesc': '开始蓄力，松开即出杆；力度越大球速越快',
    'guide.keyboardTitle': '键盘',
    'guide.keyR': '重新摆球',
    'guide.keyRDesc': '清空台面，重新摆好十五颗球',
    'guide.keyL': '逐杆回放',
    'guide.keyLDesc': '打开最近几杆的回放列表',
    'guide.keyM': '静音开关',
    'guide.keyMDesc': '关闭或恢复击球与落袋音效',
    'guide.keyH': '操作指南',
    'guide.keyHDesc': '随时打开这份说明',
    'guide.keyEsc': '暂停',
    'guide.keyEscDesc': '打开暂停菜单',
    'guide.rulesTitle': '玩法',
    'guide.badge': '自由练习',
    'guide.rule1': '自由练习模式，不计犯规、不限杆数。',
    'guide.rule2': '白球落袋会在开球点自动摆回；目标球落袋后留在袋中。',
    'guide.rule3': '清台后按 R 重新摆球，或打开回放研究每一杆。',
    'guide.close': '知道了',
    'settings.title': '设置',
    'settings.sub': '调顺手，再开球',
    'settings.sens': '鼠标灵敏度',
    'settings.volume': '音量',
    'settings.quality': '画质',
    'settings.high': '细腻',
    'settings.low': '流畅',
    'settings.close': '保存并返回',
    'common.back': '返回',
    'common.on': '开',
    'common.off': '关',
    'loading.title': '九号俱乐部',
    'loading.sub': '正在铺台、擦杆、点灯…',
    'lang.name': '中文',
    'lang.other': 'English',
  },
  en: {
    'brand.sub': 'First-person physics billiards',
    'menu.subtitle': 'CLUB No.9 · First-person physics billiards',
    'menu.title': 'CLUB No.9',
    'menu.titleEn': '九号俱乐部',
    'menu.tagline': 'The lamps are on, the rack is set — who breaks tonight?',
    'menu.start': 'Start Game',
    'menu.practice': 'Free Practice · English Table',
    'menu.guide': 'How to Play',
    'menu.settings': 'Settings',
    'menu.mute': 'Mute',
    'menu.sound': 'Sound',
    'menu.lang': '中文',
    'menu.hint': 'Aim with the mouse · hold left button to charge · release to shoot',
    'hud.practice': 'Free Practice',
    'hud.shots': 'Shots',
    'hud.potted': 'Potted',
    'hud.remain': 'Left',
    'hud.power': 'Power',
    'hud.aim': 'Move the mouse to aim',
    'hud.shoot': 'Hold left button to charge · release to shoot',
    'hud.keys': 'R re-rack · L shot replay · H guide · M mute · Esc pause',
    'hud.replay': 'Shot Replay',
    'hud.pause': 'Pause',
    'hud.locked': 'Click the table to keep aiming',
    'power.low': 'Soft',
    'power.mid': 'Medium',
    'power.high': 'Break',
    'replay.title': 'Shot Replay',
    'replay.empty': 'No shots recorded yet. Take a shot first.',
    'replay.exit': 'Exit Replay',
    'replay.restart': 'Replay',
    'replay.play': 'Play',
    'replay.pause': 'Pause',
    'replay.shot': 'Shot {n}',
    'replay.potted': '{n} potted',
    'replay.duration': '{s}s',
    'replay.listHint': 'Pick a shot to watch it again',
    'toast.potted': 'Potted!',
    'toast.cuePotted': 'Cue ball potted — returned to the head spot',
    'toast.racked': 'Fresh rack ready',
    'toast.cleared': 'Table cleared! Press R to rack again',
    'toast.locked': 'Click the table to lock the mouse',
    'pause.title': 'Paused',
    'pause.sub': 'The table is waiting for you',
    'pause.resume': 'Resume',
    'pause.rack': 'Re-rack',
    'pause.menu': 'Main Menu',
    'guide.title': 'How to Play',
    'guide.sub': 'Mouse and keyboard · learn it in a minute',
    'guide.mouseTitle': 'Mouse',
    'guide.mouseKey': 'Mouse',
    'guide.leftKey': 'LMB',
    'guide.mouseAim': 'Move the mouse',
    'guide.mouseAimDesc': 'Stand behind the cue; move the mouse to turn the cue and your view',
    'guide.mouseCharge': 'Hold left button',
    'guide.mouseChargeDesc': 'Charge the cue, release to shoot; more power means more speed',
    'guide.keyboardTitle': 'Keyboard',
    'guide.keyR': 'Re-rack',
    'guide.keyRDesc': 'Clear the table and set all fifteen balls again',
    'guide.keyL': 'Shot replay',
    'guide.keyLDesc': 'Open the list of recent shots',
    'guide.keyM': 'Mute',
    'guide.keyMDesc': 'Toggle impact and pocket sounds',
    'guide.keyH': 'This guide',
    'guide.keyHDesc': 'Open these instructions at any time',
    'guide.keyEsc': 'Pause',
    'guide.keyEscDesc': 'Open the pause menu',
    'guide.rulesTitle': 'Practice rules',
    'guide.badge': 'Free Practice',
    'guide.rule1': 'Free practice: no fouls, no shot limit.',
    'guide.rule2': 'A potted cue ball returns to the head spot; object balls stay down.',
    'guide.rule3': 'Press R after clearing the table, or study any shot in replay.',
    'guide.close': 'Got it',
    'settings.title': 'Settings',
    'settings.sub': 'Tune it to your touch',
    'settings.sens': 'Mouse sensitivity',
    'settings.volume': 'Volume',
    'settings.quality': 'Quality',
    'settings.high': 'Rich',
    'settings.low': 'Fast',
    'settings.close': 'Save & Back',
    'common.back': 'Back',
    'common.on': 'On',
    'common.off': 'Off',
    'loading.title': 'CLUB No.9',
    'loading.sub': 'Laying the cloth, chalking the cue, lighting the lamps…',
    'lang.name': 'English',
    'lang.other': '中文',
  },
}

const STORAGE_KEY = 'club9.lang'
let lang = localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'

export function t(key, vars) {
  let text = dict[lang][key] ?? dict.zh[key] ?? key
  if (vars) {
    for (const k of Object.keys(vars)) text = text.replaceAll(`{${k}}`, String(vars[k]))
  }
  return text
}

export function getLang() {
  return lang
}

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'zh'
  localStorage.setItem(STORAGE_KEY, lang)
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  applyI18n()
  window.dispatchEvent(new CustomEvent('club9:lang'))
}

export function toggleLang() {
  setLang(lang === 'zh' ? 'en' : 'zh')
  return lang
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    el.textContent = t(key)
  })
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria))
  })
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle))
  })
}

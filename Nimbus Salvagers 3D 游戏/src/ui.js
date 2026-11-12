import * as THREE from 'three'

const $ = (id) => document.getElementById(id)

const _v = new THREE.Vector3()

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      hpFill: $('hp-fill'),
      hpText: $('hp-text'),
      dashFill: $('dash-fill'),
      objText: $('obj-text'),
      objDist: $('obj-dist'),
      tokenCount: $('token-count'),
      waveLine: $('wave-line'),
      ammoNow: $('ammo-now'),
      ammoMax: $('ammo-max'),
      reloadFill: $('reload-fill'),
      skillRing: $('skill-ring'),
      dashRing: $('dash-ring'),
      skillPulse: $('skill-pulse'),
      skillDash: $('skill-dash'),
      chapterTag: $('chapter-tag'),
      chapterName: $('chapter-name'),
      waveDots: $('wave-dots'),
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      waypoint: $('waypoint'),
      waypointDist: $('waypoint-dist'),
      dialogue: $('dialogue'),
      dlgWho: $('dlg-who'),
      dlgText: $('dlg-text'),
      banner: $('banner'),
      bannerKicker: $('banner-kicker'),
      bannerTitle: $('banner-title'),
      bannerSub: $('banner-sub'),
      prompt: $('prompt'),
      promptText: $('prompt-text'),
      promptFill: $('prompt-fill'),
      toastWrap: $('toast-wrap'),
      lowhp: $('lowhp'),
      damageFlash: $('damage-flash'),
      fade: $('fade'),
      screenTitle: $('screen-title'),
      screenPause: $('screen-pause'),
      screenDead: $('screen-dead'),
      screenVictory: $('screen-victory'),
      pauseChapter: $('pause-chapter'),
      pauseWave: $('pause-wave'),
      pauseTokens: $('pause-tokens'),
      pauseKills: $('pause-kills'),
      deadWave: $('dead-wave'),
      deadKills: $('dead-kills'),
      deadTokens: $('dead-tokens'),
      winTime: $('win-time'),
      winKills: $('win-kills'),
      winTokens: $('win-tokens'),
      winUpgrades: $('win-upgrades'),
      btnSound: $('btn-sound'),
      btnPauseSound: $('btn-pause-sound'),
    }
    this.dialogueTimer = 0
    this.bannerTimer = 0
    this.toastTimer = 0
    this.lowHpOn = false
    this.hpRatio = 1
    this.waypointVisible = false
    this._lastHp = -1
  }

  /* ------------------------------------------------------------ 界面切换 */

  showHUD(show) {
    this.el.hud.classList.toggle('is-hidden', !show)
  }

  showScreen(name) {
    const map = {
      title: this.el.screenTitle,
      pause: this.el.screenPause,
      dead: this.el.screenDead,
      victory: this.el.screenVictory,
    }
    for (const key in map) {
      map[key].classList.toggle('is-hidden', key !== name)
    }
  }

  fade(on) {
    this.el.fade.classList.toggle('on', on)
  }

  /* ------------------------------------------------------------ HUD 数值 */

  setHealth(hp, max) {
    const ratio = Math.max(0, hp / max)
    this.hpRatio = ratio
    this.el.hpFill.style.width = `${ratio * 100}%`
    this.el.hpFill.classList.toggle('low', ratio < 0.35)
    this.el.hpText.textContent = `${Math.ceil(hp)} / ${Math.ceil(max)}`
    const low = ratio < 0.3
    if (low !== this.lowHpOn) {
      this.lowHpOn = low
      this.el.lowhp.classList.toggle('on', low)
    }
  }

  setDash(ratio) {
    this.el.dashFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
  }

  setAmmo(now, max, reloading, reloadRatio) {
    this.el.ammoNow.textContent = String(now)
    this.el.ammoMax.textContent = String(max)
    this.el.ammoNow.style.color = now === 0 ? '#ff8a6b' : ''
    this.el.reloadFill.style.width = reloading ? `${Math.max(0, Math.min(1, reloadRatio)) * 100}%` : '0%'
  }

  setSkill(ratio, ready) {
    this.el.skillRing.style.transform = `scaleY(${Math.max(0, 1 - ratio)})`
    this.el.skillPulse.classList.toggle('ready', ready)
  }

  setDashSkill(ratio, ready) {
    this.el.dashRing.style.transform = `scaleY(${Math.max(0, 1 - ratio)})`
    this.el.skillDash.classList.toggle('ready', ready)
  }

  setTokens(n) {
    this.el.tokenCount.textContent = String(n)
  }

  setObjective(text, distance = null) {
    if (text && this.el.objText.textContent !== text) this.el.objText.textContent = text
    this.el.objDist.textContent = distance === null ? '' : `${Math.round(distance)} m`
  }

  setChapter(index, name) {
    const tags = ['CHAPTER I', 'CHAPTER II', 'CHAPTER III']
    this.el.chapterTag.textContent = tags[index] || 'CHAPTER'
    this.el.chapterName.textContent = name || ''
  }

  setWaveLine(text) {
    this.el.waveLine.textContent = text
  }

  setWaveDots(total, active, done = 0) {
    this.el.waveDots.innerHTML = ''
    for (let i = 0; i < total; i++) {
      const d = document.createElement('i')
      if (i < done) d.className = 'done'
      else if (i === active) d.className = 'on'
      this.el.waveDots.appendChild(d)
    }
  }

  setAiming(on) {
    this.el.crosshair.classList.toggle('aiming', on)
  }

  /* ------------------------------------------------------------ 瞬时反馈 */

  hitmarker() {
    const el = this.el.hitmarker
    el.classList.remove('on')
    void el.offsetWidth
    el.classList.add('on')
  }

  damage() {
    const el = this.el.damageFlash
    el.classList.add('hit')
    setTimeout(() => el.classList.remove('hit'), 70)
  }

  /* ------------------------------------------------------------ 横幅 / 对话 */

  banner(kicker, title, sub, duration = 2600) {
    this.el.bannerKicker.textContent = kicker || ''
    this.el.bannerTitle.textContent = title || ''
    this.el.bannerSub.textContent = sub || ''
    this.el.banner.classList.add('on')
    clearTimeout(this.bannerTimer)
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('on'), duration)
  }

  dialogue(who, text, duration = 5200) {
    this.el.dlgWho.textContent = who
    this.el.dlgText.textContent = text
    this.el.dialogue.classList.add('on')
    clearTimeout(this.dialogueTimer)
    this.dialogueTimer = setTimeout(() => this.el.dialogue.classList.remove('on'), duration)
  }

  hideDialogue() {
    this.el.dialogue.classList.remove('on')
  }

  toast(text, tone = 'amber', duration = 3200) {
    const el = document.createElement('div')
    el.className = `toast ${tone}`
    el.textContent = text
    this.el.toastWrap.appendChild(el)
    setTimeout(() => {
      el.classList.add('out')
      setTimeout(() => el.remove(), 420)
    }, duration)
    while (this.el.toastWrap.children.length > 4) {
      this.el.toastWrap.firstChild.remove()
    }
  }

  setPrompt(visible, ratio = 0, text = '按住修复涡轮机') {
    this.el.prompt.classList.toggle('on', visible)
    if (visible) {
      this.el.promptText.textContent = text
      this.el.promptFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
    }
  }

  /* ------------------------------------------------------------ 世界路标 */

  updateWaypoint(camera, worldPos, origin = null) {
    if (!worldPos) {
      this.el.waypoint.classList.remove('on')
      return
    }
    _v.copy(worldPos).project(camera)
    const behind = _v.z > 1
    const w = window.innerWidth
    const h = window.innerHeight
    let x = (_v.x * 0.5 + 0.5) * w
    let y = (-_v.y * 0.5 + 0.5) * h
    if (behind) {
      x = w - x
      y = h - y
    }
    const margin = 48
    x = Math.max(margin, Math.min(w - margin, x))
    y = Math.max(124, Math.min(h - margin, y))
    const dist = origin ? origin.distanceTo(worldPos) : camera.position.distanceTo(worldPos)
    this.el.waypoint.style.left = `${x}px`
    this.el.waypoint.style.top = `${y}px`
    this.el.waypointDist.textContent = `${Math.round(dist)} m`
    this.el.waypoint.classList.add('on')
  }

  hideWaypoint() {
    this.el.waypoint.classList.remove('on')
  }

  /* ------------------------------------------------------------ 弹窗数据 */

  setPauseStats({ chapter, wave, tokens, kills }) {
    this.el.pauseChapter.textContent = chapter
    this.el.pauseWave.textContent = wave
    this.el.pauseTokens.textContent = String(tokens)
    this.el.pauseKills.textContent = String(kills)
  }

  setDeadStats({ wave, kills, tokens }) {
    this.el.deadWave.textContent = wave
    this.el.deadKills.textContent = String(kills)
    this.el.deadTokens.textContent = String(tokens)
  }

  setVictoryStats({ time, kills, tokens, upgrades }) {
    this.el.winTime.textContent = time
    this.el.winKills.textContent = String(kills)
    this.el.winTokens.textContent = String(tokens)
    this.el.winUpgrades.textContent = upgrades
  }

  setSoundLabel(muted) {
    const text = muted ? '声音：关' : '声音：开'
    if (this.el.btnSound) this.el.btnSound.textContent = text
    if (this.el.btnPauseSound) this.el.btnPauseSound.textContent = text
  }
}

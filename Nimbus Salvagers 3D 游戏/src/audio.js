/**
 * 程序化音频：所有声音由 WebAudio 实时合成，无外部音频文件。
 */

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.ready = false
    this.ambientStarted = false
    this.windGain = null
    this.padGain = null
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.55
    this.master.connect(ctx.destination)

    // 噪声缓冲
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    this.ready = true
    this.startAmbient()
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, t + 0.15)
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted)
    return this.muted
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /* ------------------------------------------------------------ 基础发声 */

  tone({ freq = 440, type = 'sine', dur = 0.2, gain = 0.2, slide = null, delay = 0, filter = null }) {
    if (!this.ready || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    let node = osc
    if (filter) {
      const f = ctx.createBiquadFilter()
      f.type = filter.type || 'lowpass'
      f.frequency.value = filter.freq || 1200
      f.Q.value = filter.q || 0.8
      node.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  noise({ dur = 0.2, gain = 0.2, type = 'bandpass', freq = 1200, q = 1, slide = null, delay = 0 }) {
    if (!this.ready || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  /* ------------------------------------------------------------ 音效 */

  shot() {
    this.noise({ dur: 0.12, gain: 0.32, freq: 2400, slide: 260, q: 0.8 })
    this.tone({ freq: 150, slide: 48, type: 'triangle', dur: 0.09, gain: 0.3 })
  }

  hit() {
    this.tone({ freq: 1180, slide: 820, type: 'square', dur: 0.05, gain: 0.06 })
  }

  kill() {
    this.tone({ freq: 660, slide: 300, type: 'triangle', dur: 0.12, gain: 0.08 })
  }

  enemyShot(type = 'drone') {
    const base = type === 'warden' ? 220 : 520
    this.tone({ freq: base, slide: base * 0.45, type: 'sawtooth', dur: 0.16, gain: 0.05, filter: { freq: 1400 } })
  }

  explode(big = false) {
    this.noise({ dur: big ? 0.9 : 0.45, gain: big ? 0.42 : 0.25, type: 'lowpass', freq: 900, slide: 90, q: 0.6 })
    this.tone({ freq: big ? 90 : 140, slide: 26, type: 'sine', dur: big ? 0.8 : 0.4, gain: big ? 0.4 : 0.22 })
  }

  jump() {
    this.tone({ freq: 220, slide: 420, type: 'sine', dur: 0.14, gain: 0.07 })
  }

  land() {
    this.noise({ dur: 0.12, gain: 0.1, type: 'lowpass', freq: 400 })
  }

  dash() {
    this.noise({ dur: 0.28, gain: 0.24, type: 'bandpass', freq: 300, slide: 2200, q: 0.9 })
    this.tone({ freq: 120, slide: 60, type: 'sine', dur: 0.2, gain: 0.12 })
  }

  reloadStart() {
    this.tone({ freq: 180, type: 'square', dur: 0.06, gain: 0.07 })
    this.noise({ dur: 0.1, gain: 0.06, freq: 900 })
  }

  reloadEnd() {
    this.tone({ freq: 320, type: 'square', dur: 0.05, gain: 0.08 })
    this.tone({ freq: 520, type: 'square', dur: 0.05, gain: 0.06, delay: 0.07 })
  }

  magOut() {
    this.noise({ dur: 0.08, gain: 0.12, type: 'bandpass', freq: 1500, q: 2 })
    this.tone({ freq: 240, type: 'square', dur: 0.05, gain: 0.05 })
  }

  magIn() {
    this.noise({ dur: 0.09, gain: 0.1, freq: 900, q: 1.4 })
    this.tone({ freq: 180, type: 'square', dur: 0.06, gain: 0.08 })
    this.tone({ freq: 340, type: 'square', dur: 0.04, gain: 0.05, delay: 0.05 })
  }

  bolt() {
    this.noise({ dur: 0.05, gain: 0.14, freq: 2600, q: 3 })
    this.tone({ freq: 420, type: 'square', dur: 0.04, gain: 0.05, delay: 0.06 })
  }

  pickup() {
    this.tone({ freq: 880, type: 'sine', dur: 0.12, gain: 0.1 })
    this.tone({ freq: 1320, type: 'sine', dur: 0.18, gain: 0.08, delay: 0.08 })
  }

  upgrade() {
    ;[523, 659, 784, 1046].forEach((f, i) => {
      this.tone({ freq: f, type: 'triangle', dur: 0.28, gain: 0.09, delay: i * 0.08 })
    })
  }

  skill() {
    this.noise({ dur: 0.5, gain: 0.3, type: 'bandpass', freq: 500, slide: 3400, q: 0.7 })
    this.tone({ freq: 90, slide: 240, type: 'sine', dur: 0.5, gain: 0.24 })
    this.tone({ freq: 1200, slide: 300, type: 'triangle', dur: 0.35, gain: 0.1 })
  }

  waveStart() {
    this.tone({ freq: 98, type: 'sawtooth', dur: 0.9, gain: 0.13, filter: { freq: 500 } })
    this.tone({ freq: 146.8, type: 'sawtooth', dur: 0.9, gain: 0.1, delay: 0.18, filter: { freq: 600 } })
  }

  waveClear() {
    this.tone({ freq: 392, type: 'triangle', dur: 0.35, gain: 0.09 })
    this.tone({ freq: 587, type: 'triangle', dur: 0.5, gain: 0.08, delay: 0.14 })
  }

  repairTick() {
    this.tone({ freq: 760, type: 'square', dur: 0.04, gain: 0.04 })
  }

  victory() {
    ;[392, 523, 659, 784, 1046].forEach((f, i) => {
      this.tone({ freq: f, type: 'triangle', dur: 0.7, gain: 0.1, delay: i * 0.16 })
    })
    this.noise({ dur: 1.6, gain: 0.12, type: 'lowpass', freq: 2200, slide: 300 })
  }

  hurt() {
    this.noise({ dur: 0.18, gain: 0.2, type: 'lowpass', freq: 700, slide: 200 })
    this.tone({ freq: 220, slide: 80, type: 'sawtooth', dur: 0.18, gain: 0.1 })
  }

  ui() {
    this.tone({ freq: 620, type: 'square', dur: 0.04, gain: 0.05 })
  }

  /* ------------------------------------------------------------ 环境声 */

  startAmbient() {
    if (this.ambientStarted || !this.ready) return
    this.ambientStarted = true
    const ctx = this.ctx

    // 风声
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    lp.Q.value = 0.5
    const g = ctx.createGain()
    g.gain.value = 0.05
    src.connect(lp)
    lp.connect(g)
    g.connect(this.master)
    src.start()
    this.windGain = g

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.09
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.025
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    lfo.start()

    // 低音铺底
    const pad = ctx.createGain()
    pad.gain.value = 0.018
    pad.connect(this.master)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600
    filter.connect(pad)
    ;[55, 82.4, 110].forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i === 2 ? 'triangle' : 'sine'
      o.frequency.value = f
      o.detune.value = (i - 1) * 6
      o.connect(filter)
      o.start()
    })
    this.padGain = pad

    // 修复后提升环境亮度
    this.ambientFilter = filter
  }

  setRepaired() {
    if (!this.ready) return
    const t = this.ctx.currentTime
    this.ambientFilter.frequency.linearRampToValueAtTime(1600, t + 2)
    this.windGain.gain.linearRampToValueAtTime(0.09, t + 2)
    this.padGain.gain.linearRampToValueAtTime(0.035, t + 2)
  }
}

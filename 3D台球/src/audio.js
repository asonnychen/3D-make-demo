// 程序化音效：不需要任何外部音频文件
class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
    this.volume = 0.7
    this.lastHit = 0
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.enabled ? this.volume : 0
    this.master.connect(this.ctx.destination)
  }

  setMuted(muted) {
    this.enabled = !muted
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02)
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02)
    }
  }

  noiseBurst(duration = 0.03, gain = 0.12, filterFreq = 2400) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration))
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4)
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = filterFreq
    filter.Q.value = 0.9
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    src.connect(filter).connect(g).connect(this.master)
    src.start(now)
    src.stop(now + duration + 0.01)
  }

  tone(freq, duration, gain = 0.08, type = 'sine', slideTo = null) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  ballHit(intensity = 1, isRail = false) {
    if (!this.enabled) return
    const now = performance.now()
    if (now - this.lastHit < 28) return
    this.lastHit = now
    const v = Math.max(0.06, Math.min(1, intensity))
    if (isRail) {
      this.tone(120 + v * 90, 0.09, 0.09 * v, 'triangle', 70)
      this.noiseBurst(0.05, 0.06 * v, 700)
    } else {
      this.tone(1500 + v * 900, 0.045, 0.1 * v, 'sine', 900)
      this.noiseBurst(0.025, 0.1 * v, 3200)
    }
  }

  cueStrike(power = 0.5) {
    if (!this.enabled) return
    const v = 0.4 + power * 0.6
    this.tone(260, 0.07, 0.12 * v, 'triangle', 110)
    this.noiseBurst(0.04, 0.14 * v, 1800)
  }

  pocket() {
    if (!this.enabled) return
    this.tone(220, 0.32, 0.12, 'sine', 70)
    this.noiseBurst(0.18, 0.07, 420)
    this.tone(90, 0.4, 0.09, 'triangle', 48)
  }

  uiClick() {
    if (!this.enabled) return
    this.tone(880, 0.035, 0.035, 'sine', 660)
  }

  chargeTick(power) {
    if (!this.enabled) return
    this.tone(300 + power * 700, 0.03, 0.025, 'square')
  }
}

export const audio = new AudioEngine()

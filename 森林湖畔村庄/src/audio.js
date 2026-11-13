/* ============================================================
   环境声：WebAudio 合成的林间风声与偶发鸟鸣
   ============================================================ */

export class Ambience {
  constructor() {
    this.ctx = null
    this.enabled = false
    this.master = null
    this.birdTimer = null
  }

  start() {
    if (this.ctx) {
      this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.0001
    this.master.connect(this.ctx.destination)

    // 风：循环噪声 + 低通
    const seconds = 4
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.97 + white * 0.03
      data[i] = last * 3.2
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 520
    const windGain = this.ctx.createGain()
    windGain.gain.value = 0.16
    src.connect(filter).connect(windGain).connect(this.master)
    src.start()

    // 缓慢的风势起伏
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain).connect(windGain.gain)
    lfo.start()

    this.scheduleBird()
    this.enabled = true
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.2)
  }

  scheduleBird() {
    if (!this.ctx) return
    const delay = 3200 + Math.random() * 5200
    this.birdTimer = setTimeout(() => {
      if (this.enabled) this.chirp()
      this.scheduleBird()
    }, delay)
  }

  chirp() {
    if (!this.ctx) return
    const t0 = this.ctx.currentTime
    const notes = 2 + Math.floor(Math.random() * 3)
    const base = 2100 + Math.random() * 900
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.05)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t)
      osc.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t + 0.07)
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.055, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      osc.connect(gain).connect(this.master)
      osc.start(t)
      osc.stop(t + 0.12)
    }
  }

  setEnabled(on) {
    if (on) {
      this.start()
      this.enabled = true
      if (this.ctx) this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.5)
    } else {
      this.enabled = false
      if (this.ctx) this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3)
    }
  }
}

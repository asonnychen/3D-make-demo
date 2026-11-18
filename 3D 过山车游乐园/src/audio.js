export class ParkAudio {
  constructor() {
    this.context = null
    this.enabled = false
    this.master = null
    this.windGain = null
    this.turnGain = null
    this.windFilter = null
    this.nextClickAt = 0
  }

  ensureContext() {
    if (this.context) return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    this.context = new AudioContext()
    this.master = this.context.createGain()
    this.master.gain.value = 0.55
    this.master.connect(this.context.destination)

    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1
    }
    this.noiseBuffer = noiseBuffer

    const windSource = this.context.createBufferSource()
    windSource.buffer = noiseBuffer
    windSource.loop = true
    this.windFilter = this.context.createBiquadFilter()
    this.windFilter.type = 'bandpass'
    this.windFilter.frequency.value = 600
    this.windFilter.Q.value = 0.7
    this.windGain = this.context.createGain()
    this.windGain.gain.value = 0
    windSource.connect(this.windFilter).connect(this.windGain).connect(this.master)
    windSource.start()

    const turnSource = this.context.createBufferSource()
    turnSource.buffer = noiseBuffer
    turnSource.loop = true
    const turnFilter = this.context.createBiquadFilter()
    turnFilter.type = 'bandpass'
    turnFilter.frequency.value = 1850
    turnFilter.Q.value = 2.4
    this.turnGain = this.context.createGain()
    this.turnGain.gain.value = 0
    turnSource.connect(turnFilter).connect(this.turnGain).connect(this.master)
    turnSource.start()
  }

  async setEnabled(enabled) {
    this.enabled = enabled
    if (enabled) {
      this.ensureContext()
      if (this.context?.state === 'suspended') await this.context.resume()
    } else if (this.context) {
      await this.context.suspend()
    }
  }

  click() {
    if (!this.enabled || !this.context) return
    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const filter = this.context.createBiquadFilter()
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(165, now)
    oscillator.frequency.exponentialRampToValueAtTime(82, now + 0.045)
    filter.type = 'highpass'
    filter.frequency.value = 620
    gain.gain.setValueAtTime(0.055, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    oscillator.connect(filter).connect(gain).connect(this.master)
    oscillator.start(now)
    oscillator.stop(now + 0.08)
  }

  update(speed, zone, gForce, delta) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return
    const now = this.context.currentTime
    const speedFactor = THREE_CLAMP(speed / 30, 0, 1)
    this.windFilter.frequency.setTargetAtTime(380 + speedFactor * 1350, now, 0.08)
    this.windGain.gain.setTargetAtTime(speedFactor * 0.24, now, 0.08)
    const turnFactor = THREE_CLAMP((Math.abs(gForce - 1) - 0.35) * 0.38, 0, 0.28)
    this.turnGain.gain.setTargetAtTime(turnFactor * speedFactor, now, 0.05)

    if (zone === 'chain') {
      this.nextClickAt -= delta
      if (this.nextClickAt <= 0) {
        this.click()
        this.nextClickAt = 0.17
      }
    } else {
      this.nextClickAt = 0
    }
  }
}

function THREE_CLAMP(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

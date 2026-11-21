// 纯 Web Audio API 程序化音频引擎：原创广播电台、拟真引擎音效与环境音

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.radioPlaying = true;
    this.currentStationIndex = 0;
    this.masterGain = null;
    this.radioGain = null;
    this.sfxGain = null;
    this.initialized = false;

    // 电台列表
    this.stations = [
      {
        id: 'harbor',
        name: '海港频率 (Harbor Frequencies)',
        desc: '午后 Lo-Fi 弦律与柔和海风',
        chords: [
          [261.63, 329.63, 392.00, 493.88], // Cmaj7
          [220.00, 261.63, 329.63, 392.00], // Am7
          [174.61, 220.00, 261.63, 329.63], // Fmaj7
          [196.00, 246.94, 293.66, 349.23]  // G7
        ],
        tempo: 78
      },
      {
        id: 'tramline',
        name: '午后电车 (Tramline Afternoon)',
        desc: '慵懒阳光爵士与电车轨道行进曲',
        chords: [
          [293.66, 349.23, 440.00, 523.25], // Dm7
          [196.00, 246.94, 293.66, 349.23], // G7
          [261.63, 329.63, 392.00, 493.88], // Cmaj7
          [220.00, 261.63, 329.63, 392.00]  // Am7
        ],
        tempo: 88
      },
      {
        id: 'tidal',
        name: '潮汐微风 (Tidal Breeze)',
        desc: '轻盈海浪白噪音与空灵琶音',
        chords: [
          [329.63, 392.00, 493.88, 587.33], // Em7
          [220.00, 261.63, 329.63, 392.00], // Am7
          [293.66, 369.99, 440.00, 523.25], // D7
          [196.00, 246.94, 293.66, 392.00]  // G
        ],
        tempo: 68
      }
    ];

    // 电台定时器
    this.radioTimer = null;
    this.stepIndex = 0;

    // 引擎振荡器
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;

    // 海浪噪音节点
    this.seaGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // 主音量节点
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 电台子音量
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.radioGain.connect(this.masterGain);

      // 音效子音量
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // 启动海浪与环境白噪音
      this.startSeaAmbience();

      // 启动引擎声音
      this.startEngineAudio();

      // 启动原创电台
      this.startRadio();

      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext 初始化跳过:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 海浪微风背景
  startSeaAmbience() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // 粉红噪声
      lastOut = output[i];
      output[i] *= 2.5;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    // LFO 缓慢呼吸模拟海浪涨落
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8 秒一个周期
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(180, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    this.seaGain = this.ctx.createGain();
    this.seaGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.seaGain);
    this.seaGain.connect(this.masterGain);

    whiteNoise.start();
    lfo.start();
  }

  // 汽车引擎音效
  startEngineAudio() {
    if (!this.ctx) return;
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';

    this.engineOsc1.frequency.setValueAtTime(35, this.ctx.currentTime);
    this.engineOsc2.frequency.setValueAtTime(35 * 0.5, this.ctx.currentTime);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3, this.ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  // 根据当前车速和油门动态更新引擎转速
  updateEngine(speedKmh, throttle, isBoosting) {
    if (!this.engineOsc1 || !this.ctx) return;
    const baseFreq = 32;
    const speedRatio = Math.min(Math.abs(speedKmh) / 110, 1.2);
    const throttleBonus = throttle ? 0.35 : 0;
    const boostBonus = isBoosting ? 0.5 : 0;

    const targetFreq = baseFreq + speedRatio * 90 + throttleBonus * 35 + boostBonus * 50;
    const targetFilter = 140 + speedRatio * 450 + (throttle ? 200 : 0) + (isBoosting ? 350 : 0);
    const targetVol = 0.12 + speedRatio * 0.15 + (throttle ? 0.08 : 0);

    const now = this.ctx.currentTime;
    this.engineOsc1.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.1);
  }

  // 手刹/漂移轮胎尖叫声
  playSkidSound(intensity = 0.5) {
    if (!this.ctx || this.isMuted) return;
    try {
      const bufferSize = this.ctx.sampleRate * 0.15;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 + Math.random() * 400, this.ctx.currentTime);
      filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08 * Math.min(intensity, 1), this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start();
    } catch (_) {}
  }

  // 车辆碰撞声
  playCrashSound(severity = 0.5) {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.25);

      gain.gain.setValueAtTime(0.35 * Math.min(severity, 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (_) {}
  }

  // 氮气加速呼啸声
  playNitroSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (_) {}
  }

  // 电车“叮叮”铃声
  playTramBell() {
    if (!this.ctx || this.isMuted) return;
    try {
      const ring = (freq, delay) => {
        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.36);
      };

      ring(1320, 0);
      ring(1568, 0.18);
    } catch (_) {}
  }

  // 拾取邮包或赚钱音效
  playMoneyChime() {
    if (!this.ctx || this.isMuted) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
      notes.forEach((pitch, i) => {
        const now = this.ctx.currentTime + i * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, now);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.3);
      });
    } catch (_) {}
  }

  // 收音机换台杂音
  playRadioTuning() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.25;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.25);

      noise.connect(gain);
      gain.connect(this.radioGain);
      noise.start(now);
    } catch (_) {}
  }

  // 原创广播电台音轨循环
  startRadio() {
    if (this.radioTimer) clearInterval(this.radioTimer);

    const station = this.stations[this.currentStationIndex];
    const beatInterval = (60 / station.tempo) * 1000 * 0.5; // 半拍

    this.stepIndex = 0;
    this.radioTimer = setInterval(() => {
      if (!this.radioPlaying || this.isMuted || !this.ctx) return;
      this.playRadioStep(station);
      this.stepIndex = (this.stepIndex + 1) % 16;
    }, beatInterval);
  }

  // 播放电台节拍
  playRadioStep(station) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chordIdx = Math.floor(this.stepIndex / 4) % station.chords.length;
    const chord = station.chords[chordIdx];
    const subStep = this.stepIndex % 4;

    // 电钢琴 / 爵士和弦音
    if (subStep === 0 || subStep === 2) {
      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        // 加入轻微微调使其更有模拟复古磁带漂移感
        const detune = (idx - 1.5) * 4 + (Math.random() - 0.5) * 3;
        osc.frequency.setValueAtTime(freq + detune, now);

        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(gain);
        gain.connect(this.radioGain);
        osc.start(now);
        osc.stop(now + 0.7);
      });
    }

    // 贝斯行走线
    if (subStep === 0 || subStep === 3) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'triangle';
      const rootFreq = chord[0] * 0.5;
      bassOsc.frequency.setValueAtTime(rootFreq, now);

      bassGain.gain.setValueAtTime(0.07, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      bassOsc.connect(bassGain);
      bassGain.connect(this.radioGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.42);
    }

    // 轻柔鼓点 / 沙锤
    if (subStep === 1 || subStep === 3) {
      // 软军鼓/沙锤
      const bufferSize = this.ctx.sampleRate * 0.05;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const snareSource = this.ctx.createBufferSource();
      snareSource.buffer = noiseBuffer;
      const snareFilter = this.ctx.createBiquadFilter();
      snareFilter.type = 'highpass';
      snareFilter.frequency.setValueAtTime(1800, now);

      const snareGain = this.ctx.createGain();
      snareGain.gain.setValueAtTime(0.02, now);
      snareGain.gain.linearRampToValueAtTime(0.001, now + 0.05);

      snareSource.connect(snareFilter);
      snareFilter.connect(snareGain);
      snareGain.connect(this.radioGain);
      snareSource.start(now);
    }
  }

  // 切换下一个电台
  nextStation() {
    this.currentStationIndex = (this.currentStationIndex + 1) % this.stations.length;
    this.playRadioTuning();
    this.startRadio();
    return this.getCurrentStation();
  }

  getCurrentStation() {
    return this.stations[this.currentStationIndex];
  }

  toggleRadio() {
    this.radioPlaying = !this.radioPlaying;
    if (this.radioPlaying) {
      this.playRadioTuning();
      this.startRadio();
    }
    return this.radioPlaying;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();

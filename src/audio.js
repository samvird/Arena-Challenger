class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, endFreq, duration, type = 'sine', volume = 0.15) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  swing() {
    this.playTone(340, 140, 0.11, 'triangle', 0.12);
  }

  hit() {
    this.playTone(190, 65, 0.12, 'sawtooth', 0.16);
  }

  dash() {
    this.playTone(520, 180, 0.14, 'sine', 0.12);
  }

  jump() {
    this.playTone(240, 480, 0.14, 'sine', 0.11);
  }

  bumper() {
    this.playTone(280, 660, 0.18, 'triangle', 0.16);
  }

  slam() {
    this.playTone(160, 38, 0.28, 'sawtooth', 0.24);
  }

  playerHurt() {
    this.playTone(150, 55, 0.18, 'square', 0.16);
  }

  enemyDie() {
    this.playTone(420, 110, 0.16, 'triangle', 0.13);
  }

  bounceBack() {
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.15, 0.26, 'triangle', 0.16), idx * 55);
    });
  }

  waveStart() {
    if (!this.ctx) return;
    this.playTone(220, 330, 0.22, 'triangle', 0.14);
    setTimeout(() => this.playTone(330, 440, 0.28, 'triangle', 0.15), 140);
  }

  uiClick() {
    this.playTone(580, 740, 0.055, 'triangle', 0.08);
  }
}

export const sfx = new SoundFX();

const YT_VIDEO_ID = '4X8P5K9pVMc';

class MusicController {
  constructor() {
    this.ytPlayer = null;
    this.ytReady = false;
    this.ytFailed = false;
    this.started = false;
    this.muted = false;
    this.synthTimer = null;
    this.step = 0;

    this.initYouTubeAPI();
  }

  initYouTubeAPI() {
    // Load YouTube IFrame API asynchronously so it never blocks game startup
    window.onYouTubeIframeAPIReady = () => {
      if (!window.YT || !window.YT.Player) {
        this.ytFailed = true;
        return;
      }
      const el = document.getElementById('yt-music-player');
      if (!el) return;

      this.ytPlayer = new window.YT.Player('yt-music-player', {
        height: '1',
        width: '1',
        videoId: YT_VIDEO_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          loop: 1,
          playlist: YT_VIDEO_ID,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            this.ytReady = true;
            this.ytPlayer.setVolume(45);
            if (this.started && !this.muted && !this.ytFailed) {
              this.ytPlayer.playVideo();
            }
          },
          onError: () => {
            // Embedding disabled or offline -> fall back to built-in synth track
            this.ytFailed = true;
            if (this.started && !this.muted) {
              this.startSynthLoop();
            }
          },
        },
      });
    };

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => {
        this.ytFailed = true;
      };
      document.head.appendChild(tag);
    }
  }

  start() {
    this.started = true;
    sfx.init();
    if (this.muted) return;

    if (this.ytReady && !this.ytFailed && this.ytPlayer?.playVideo) {
      this.ytPlayer.playVideo();
      // Verify playback actually starts; if blocked/errored, start synth fallback
      setTimeout(() => {
        if (!this.started || this.muted) return;
        const state = this.ytPlayer?.getPlayerState?.();
        if (state !== 1 && state !== 3) {
          this.ytFailed = true;
          this.startSynthLoop();
        }
      }, 2800);
    } else if (this.ytFailed) {
      this.startSynthLoop();
    } else {
      // Wait briefly for YT API; if still not ready, run synth fallback
      setTimeout(() => {
        if (this.started && !this.muted && !this.ytReady) {
          this.ytFailed = true;
          this.startSynthLoop();
        }
      }, 3000);
    }
  }

  toggle() {
    this.muted = !this.muted;
    if (this.muted) {
      if (this.ytReady && this.ytPlayer?.pauseVideo) {
        this.ytPlayer.pauseVideo();
      }
      this.stopSynthLoop();
    } else {
      this.start();
    }
    return !this.muted;
  }

  startSynthLoop() {
    if (this.synthTimer || this.muted) return;
    sfx.init();
    const bassNotes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    const leadNotes = [220, 261.63, 329.63, 440, 392, 329.63, 293.66, 329.63];

    this.synthTimer = setInterval(() => {
      if (this.muted || !sfx.ctx) return;
      const i = this.step % 8;

      // Driving synth bass
      sfx.playTone(bassNotes[i], bassNotes[i] * 0.98, 0.18, 'sawtooth', 0.045);

      // Kick pulse on beats 0, 2, 4, 6
      if (i % 2 === 0) {
        sfx.playTone(95, 36, 0.12, 'sine', 0.09);
      }

      // Arpeggio lead
      if (this.step % 2 === 0) {
        const note = leadNotes[(this.step / 2) % leadNotes.length];
        sfx.playTone(note, note * 1.01, 0.22, 'triangle', 0.035);
      }

      this.step++;
    }, 185);
  }

  stopSynthLoop() {
    if (this.synthTimer) {
      clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
  }
}

export const music = new MusicController();

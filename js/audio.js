/**
 * ANTIGRAVITY — audio.js
 * Hybrid audio system using procedural sounds and specific audio files.
 */

const Audio = (() => {
  let ctx, master;
  let noiseBuffer;
  let isChasing = false;
  let micStream = null;
  let analyser = null;
  let micDataArray = null;

  let fudoAudio = new window.Audio('assets/audio/fudo.mp3');
  fudoAudio.loop = true;
  fudoAudio.volume = 0.4;

  let zeAudio = new window.Audio('assets/audio/ze.mp3');
  zeAudio.loop = true;
  zeAudio.volume = 0.6;

  let geraAudio = new window.Audio('assets/audio/gera.mp3');
  geraAudio.volume = 0.8;

  let peAudio = new window.Audio('assets/audio/pe.mp3');
  peAudio.volume = 0.5;

  function init(){
    if(ctx) return;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      _mkNoise();
    }catch(e){ console.warn('Audio init failed',e); }
  }

  function resume(){ 
    if(ctx&&ctx.state==='suspended') ctx.resume(); 
    // Prepare HTML5 audio
    fudoAudio.load();
    zeAudio.load();
    geraAudio.load();
    peAudio.load();
  }

  function _mkNoise(){
    const len = ctx.sampleRate*2;
    noiseBuffer = ctx.createBuffer(1,len,ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  }

  /* ── ambient drone (now FUDO) ──────────────────────────────── */
  function startDrone(){
    fudoAudio.currentTime = 0;
    fudoAudio.play().catch(e => console.warn('Fudo play failed:', e));
  }

  function stopDrone(){
    fudoAudio.pause();
  }

  /* ── footsteps ──────────────────────────────────── */
  let lastStep=0;
  function playStep(running){
    const now=Date.now(), iv=running?220:360;
    if(now-lastStep<iv) return; lastStep=now;
    
    if(peAudio.paused || peAudio.ended) {
      peAudio.currentTime = 0;
      peAudio.play().catch(e => console.warn('Pe play failed:', e));
    }
  }

  function stopSteps(){
    peAudio.pause();
    peAudio.currentTime = 0;
  }

  /* ── waka-waka (entity nearby) ──────────────────── */
  function playWaka(proximity){
    // Retained for any procedural mix, but ZE handles the main chase music now.
    if(zeAudio && !zeAudio.paused) {
      zeAudio.volume = Math.min(1.0, 0.2 + proximity * 0.8);
    }
  }

  /* ── chase music (now ZE) ──────── */
  function startChase(){
    if(isChasing) return; 
    isChasing=true;
    zeAudio.play().catch(e => console.warn('Ze play failed:', e));
  }

  function stopChase(){
    if(!isChasing) return;
    isChasing=false;
    zeAudio.pause();
    zeAudio.currentTime = 0; 
  }

  /* ── collect memory ─────────────────────────────── */
  function playCollect(){
    if(!ctx) return;
    [440,550,660,880].forEach((f,i)=>{
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=ctx.createGain(); g.gain.value=0;
      o.connect(g); g.connect(master); o.start();
      const t=ctx.currentTime+i*0.06;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.12,t+0.03);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
      o.stop(t+0.28);
    });
  }

  /* ── death sound (now GERA) ────────────────────────────────── */
  function playDeath(){
    stopDrone(); stopChase();
    geraAudio.currentTime = 0;
    geraAudio.play().catch(e => console.warn('Gera play failed:', e));
  }

  /* ── portal spawn ───────────────────────────────── */
  function playPortal(){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=40;
    const s=ctx.createOscillator(); s.type='sine'; s.frequency.value=1100;
    s.frequency.exponentialRampToValueAtTime(700,ctx.currentTime+2);
    const og=ctx.createGain(); og.gain.value=0.25;
    const sg=ctx.createGain(); sg.gain.value=0.04;
    o.connect(og); og.connect(master);
    s.connect(sg); sg.connect(master);
    o.start(); s.start();
    og.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+2.5);
    sg.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+2);
    o.stop(ctx.currentTime+3); s.stop(ctx.currentTime+2.5);
  }

  /* ── level complete ─────────────────────────────── */
  function playVictory(){
    stopDrone(); stopChase();
    if(!ctx) return; 
    [262,330,392,523,659,784].forEach((f,i)=>{
      const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=ctx.createGain(); g.gain.value=0;
      o.connect(g); g.connect(master); o.start();
      const t=ctx.currentTime+i*0.1;
      g.gain.setValueAtTime(0.001,t);
      g.gain.exponentialRampToValueAtTime(0.15,t+0.04);
      g.gain.exponentialRampToValueAtTime(0.001,t+1.2);
      o.stop(t+1.3);
    });
  }

  /* ── UI click ───────────────────────────────────── */
  function click(){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='square'; o.frequency.value=900;
    const g=ctx.createGain(); g.gain.value=0.06;
    o.connect(g); g.connect(master); o.start();
    g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.05);
    o.stop(ctx.currentTime+0.06);
  }

  async function initMic(){
    if(!ctx) init();
    if(micStream) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const source = ctx.createMediaStreamSource(micStream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      micDataArray = new Uint8Array(analyser.frequencyBinCount);
      console.log('Microphone initialized');
    } catch(err) {
      console.warn('Microphone access denied or error:', err);
    }
  }

  function getMicVolume(){
    if(!analyser || !micDataArray) return 0;
    analyser.getByteFrequencyData(micDataArray);
    let sum = 0;
    for(let i=0; i<micDataArray.length; i++) {
        sum += micDataArray[i];
    }
    return sum / micDataArray.length;
  }

  return {
    init,resume,startDrone,stopDrone,
    playStep,stopSteps,playWaka,startChase,stopChase,
    playCollect,playDeath,playPortal,playVictory,click,
    initMic,getMicVolume
  };
})();

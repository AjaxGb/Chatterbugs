
const pentatonic = [110, 123.471, 138.591, 164.814, 184.997, 220, 246.942, 277.182, 329.628, 369.994];
const twelvetone = [110, 116.541, 123.471, 130.813, 138.591, 146.832, 155.563, 164.814, 174.614, 184.997, 195.997, 207.652];

export default class GameAudio {
	constructor() {
		this.ac = new AudioContext();
		
		this.bellWave = this.ac.createPeriodicWave(
			new Float32Array([0.00, 0.70, 0.05, 0.00, 0.50]),
			new Float32Array([0.00, 0.00, 0.00, 0.00, 0.00]));
		this.bellWaveLength = 5;
		
		this.bellFadeIn = 0.01;
		
		this.bellConstLowpass = this.ac.createBiquadFilter();
		this.bellConstLowpass.type = "lowpass";
		this.bellConstLowpass.frequency.setValueAtTime(3000, 0);
		this.bellConstLowpass.Q.setValueAtTime(0.1, 0);
		this.bellConstLowpass.connect(this.ac.destination);
	}
	
	playPentatonicBell(index, dur) {
		this.playBell(pentatonic[index % pentatonic.length], dur);
	}
	
	playTwelveToneBell(index, dur) {
		this.playBell(twelvetone[index % twelvetone.length], dur);
	}
	
	playBell(freq, dur) {
		const currTime = this.ac.currentTime;
		
		const osc = this.ac.createOscillator();
		osc.setPeriodicWave(this.bellWave);
		osc.frequency.setValueAtTime(freq, currTime);
		
		const gain = this.ac.createGain();
		gain.gain.setValueAtTime(0, currTime);
		gain.gain.linearRampToValueAtTime(
			0.3,
			currTime + this.bellFadeIn);
		gain.gain.exponentialRampToValueAtTime(
			0.00001,
			currTime + dur);
		
		const filter = this.ac.createBiquadFilter();
		filter.type = "lowpass";
		filter.Q.setValueAtTime(3, currTime);
		filter.frequency.setValueAtTime(freq / 2, currTime);
		filter.frequency.exponentialRampToValueAtTime(
			freq * this.bellWaveLength,
			currTime + this.bellFadeIn);
		filter.frequency.exponentialRampToValueAtTime(
			freq / 2,
			currTime + dur / 2);
		
		osc.connect(gain);
		gain.connect(filter);
		filter.connect(this.bellConstLowpass);
		osc.start();
		osc.stop(currTime + dur);
	}
}

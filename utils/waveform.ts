/**
 * Vertical waveform support: fetch an audio file, decode it and reduce it to
 * a fixed number of peak amplitudes that t-marker-slider draws beside the
 * timeline. Never rejects — decoding failures resolve to null so a missing
 * waveform never breaks song loading.
 */

const getAudioContextConstructor = (): typeof AudioContext | null => {
  const scope = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
};

/**
 * Handles both the promise style (decodeAudioData(data)) and the legacy
 * callback style (decodeAudioData(data, onSuccess, onError)) of decoding.
 */
const decodeAudioData = (
  audioContext: AudioContext,
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (buffer: AudioBuffer): void => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const result = audioContext.decodeAudioData(arrayBuffer, succeed, fail) as
      | Promise<AudioBuffer>
      | undefined;
    if (result) {
      void result.then(succeed, fail);
    }
  });

/** Peak absolute amplitude of channel 0 per equal time bucket, normalized to 1.0. */
const extractPeaks = (audioBuffer: AudioBuffer, numPeaks: number): Float32Array => {
  const samples = audioBuffer.getChannelData(0);
  const peaks = new Float32Array(numPeaks);
  const samplesPerPeak = samples.length / numPeaks;

  let maxPeak = 0;
  for (let i = 0; i < numPeaks; i++) {
    const start = Math.floor(i * samplesPerPeak);
    const end = Math.min(samples.length, Math.floor((i + 1) * samplesPerPeak));
    let peak = 0;
    for (let s = start; s < end; s++) {
      const magnitude = Math.abs(samples[s]);
      if (magnitude > peak) {
        peak = magnitude;
      }
    }
    peaks[i] = peak;
    if (peak > maxPeak) {
      maxPeak = peak;
    }
  }

  if (maxPeak > 0) {
    for (let i = 0; i < numPeaks; i++) {
      peaks[i] = peaks[i] / maxPeak;
    }
  }

  return peaks;
};

export async function generateWaveformPeaks(
  audioUrl: string,
  numPeaks: number = 300
): Promise<Float32Array | null> {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    const audioContext = new AudioContextConstructor();
    try {
      const audioBuffer = await decodeAudioData(audioContext, arrayBuffer);
      return extractPeaks(audioBuffer, numPeaks);
    } finally {
      void audioContext.close();
    }
  } catch {
    return null;
  }
}

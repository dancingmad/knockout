import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button, Slider, Space } from 'antd';
import {
  PlayCircleOutlined, PauseCircleOutlined, StopOutlined,
} from '@ant-design/icons';

export default function WaveformPlayer({ url, compact = false, onReady }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    // Destroy previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    setIsReady(false);
    setIsPlaying(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#3a5a3a',
      progressColor: '#ff681d',
      cursorColor: '#ff681d',
      barWidth: 2,
      barGap: 1,
      height: compact ? 48 : 80,
      normalize: true,
      backend: 'WebAudio',
      interact: true,
    });

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(volume / 100);
      if (onReady) onReady(ws);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('error', (err) => console.error('WaveSurfer error:', err));

    ws.load(url);
    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [url]);

  const handlePlayPause = () => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.playPause();
  };

  const handleStop = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.stop();
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(val / 100);
    }
  };

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0.0';
    return t.toFixed(1) + 's';
  };

  return (
    <div>
      {/* Waveform */}
      <div
        ref={containerRef}
        className="waveform-container"
        style={{ minHeight: compact ? 48 : 80 }}
      />

      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
      }}>
        <button
          className={`transport-btn ${isPlaying ? 'active' : ''}`}
          onClick={handlePlayPause}
          disabled={!isReady}
        >
          {isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        </button>

        {!compact && (
          <button className="transport-btn" onClick={handleStop} disabled={!isReady}>
            <StopOutlined />
          </button>
        )}

        <span style={{ fontSize: 9, color: '#666', marginLeft: 4 }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {!compact && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 9, color: '#555' }}>VOL</span>
            <Slider
              min={0}
              max={100}
              value={volume}
              onChange={handleVolumeChange}
              style={{ flex: 1 }}
              size="small"
            />
          </div>
        )}
      </div>
    </div>
  );
}

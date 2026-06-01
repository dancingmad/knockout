import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Input, Select, Tag, Spin, Empty, Tooltip,
  Typography, Space, Badge, Button, Drawer, Descriptions,
} from 'antd';
import {
  SearchOutlined, PlayCircleOutlined, PauseCircleOutlined,
  FolderOutlined, AudioOutlined, InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import useStore from '../store';
import { getCategoryById, SLOT_CATEGORIES, formatDuration, formatSize, formatBpm } from '../utils/ko2';
import { audioApi } from '../utils/api';
import WaveformPlayer from '../components/WaveformPlayer';
import AddToProjectModal from '../components/AddToProjectModal';

const { Text, Title } = Typography;
const { Option } = Select;

export default function LibraryPage() {
  const {
    sampleSets, samples, samplesLoading, selectedSample,
    sampleFilter, currentSetId,
    loadSamples, setSelectedSample, setSampleFilter,
  } = useStore();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Load all samples on mount
  useEffect(() => {
    loadSamples(null);
  }, []);

  const handleSetChange = (setId) => {
    loadSamples(setId || null);
  };

  // Filtered samples
  const filtered = samples.filter(s => {
    if (sampleFilter.category && s.category !== sampleFilter.category) return false;
    if (sampleFilter.search) {
      const q = sampleFilter.search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.filename.toLowerCase().includes(q) ||
        (s.key && s.key.toLowerCase().includes(q)) ||
        (s.setName && s.setName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleSampleClick = (sample) => {
    setSelectedSample(sample);
  };

  const handleAddToProject = () => {
    if (!selectedSample) return;
    setAddModalOpen(true);
  };

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        padding: '8px 16px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <Title level={5} style={{ margin: 0, color: '#ff681d', fontSize: 11, letterSpacing: 2 }}>
          SAMPLE LIBRARY
        </Title>
        <div style={{ width: 1, height: 16, background: '#333', margin: '0 4px' }} />

        {/* Set selector */}
        <Select
          placeholder="All Sets"
          allowClear
          style={{ width: 160 }}
          onChange={handleSetChange}
          value={currentSetId}
          size="small"
        >
          {sampleSets.map(set => (
            <Option key={set.id} value={set.id}>
              <FolderOutlined /> {set.name}
            </Option>
          ))}
        </Select>

        {/* Category filter */}
        <Select
          placeholder="All Categories"
          allowClear
          style={{ width: 130 }}
          size="small"
          onChange={val => setSampleFilter({ category: val })}
          value={sampleFilter.category}
        >
          {SLOT_CATEGORIES.map(cat => (
            <Option key={cat.id} value={cat.id}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 2,
                background: cat.color,
                marginRight: 6,
              }} />
              {cat.label}
            </Option>
          ))}
        </Select>

        {/* Search */}
        <Input
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          placeholder="Search samples..."
          style={{ width: 220 }}
          size="small"
          value={sampleFilter.search}
          onChange={e => setSampleFilter({ search: e.target.value })}
          allowClear
        />

        <div style={{ marginLeft: 'auto', color: '#666', fontSize: 10 }}>
          {filtered.length} samples
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sample List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#151515',
        }}>
          {samplesLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : filtered.length === 0 ? (
            <Empty description="No samples found" style={{ marginTop: 60 }} />
          ) : (
            <SampleList
              samples={filtered}
              selectedSample={selectedSample}
              onSelect={handleSampleClick}
            />
          )}
        </div>

        {/* Preview Panel */}
        {selectedSample && (
          <div style={{
            width: 340,
            borderLeft: '1px solid #333',
            background: '#1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <SamplePreviewPanel
              sample={selectedSample}
              onAddToProject={handleAddToProject}
            />
          </div>
        )}
      </div>

      {/* Add to Project Modal */}
      <AddToProjectModal
        open={addModalOpen}
        sample={selectedSample}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
}

// ─── Sample List ─────────────────────────────────────────────────────────────
function SampleList({ samples, selectedSample, onSelect }) {
  // Group by set
  const grouped = samples.reduce((acc, s) => {
    const key = s.setName || s.setId || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(grouped).map(([setName, setsamples]) => (
        <div key={setName}>
          <div style={{
            padding: '4px 16px',
            background: '#111',
            color: '#555',
            fontSize: 9,
            letterSpacing: 2,
            textTransform: 'uppercase',
            position: 'sticky',
            top: 0,
            zIndex: 1,
            borderBottom: '1px solid #222',
          }}>
            <FolderOutlined style={{ marginRight: 4 }} />
            {setName} <span style={{ color: '#444' }}>({setsamples.length})</span>
          </div>
          {setsamples.map(sample => (
            <SampleRow
              key={sample.id}
              sample={sample}
              selected={selectedSample?.id === sample.id}
              onClick={() => onSelect(sample)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Sample Row ───────────────────────────────────────────────────────────────
function SampleRow({ sample, selected, onClick }) {
  const cat = getCategoryById(sample.category);

  return (
    <div
      className={`sample-row ${selected ? 'selected' : ''}`}
      onClick={onClick}
      style={{
        borderBottom: '1px solid #1e1e1e',
        paddingLeft: selected ? 14 : 16,
        borderLeft: selected ? '2px solid #ff681d' : '2px solid transparent',
      }}
    >
      {/* Category dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: 2,
        background: cat?.color || '#666',
        flexShrink: 0,
        marginRight: 8,
      }} />

      {/* Name */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 11,
          color: '#ddd',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {sample.name}
        </div>
        <div style={{ fontSize: 9, color: '#555', display: 'flex', gap: 8 }}>
          {sample.bpm && <span>{sample.bpm} BPM</span>}
          {sample.key && <span>{sample.key}</span>}
          {sample.isLoop && <span style={{ color: '#00bcd4' }}>LOOP</span>}
        </div>
      </div>

      {/* Category tag */}
      <div style={{ marginLeft: 8, flexShrink: 0 }}>
        <span className="category-badge" style={{
          background: cat?.darkColor || '#333',
          color: cat?.color || '#888',
          fontSize: 8,
          padding: '1px 4px',
          borderRadius: 2,
        }}>
          {cat?.label || 'MISC'}
        </span>
      </div>

      {/* Size */}
      <div style={{ marginLeft: 8, color: '#444', fontSize: 9, flexShrink: 0 }}>
        {formatSize(sample.size)}
      </div>
    </div>
  );
}

// ─── Sample Preview Panel ────────────────────────────────────────────────────
function SamplePreviewPanel({ sample, onAddToProject }) {
  const cat = getCategoryById(sample.category);
  const streamUrl = audioApi.getStreamUrl(sample.relativePath);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #2a2a2a',
        background: '#151515',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: 12,
              color: '#eee',
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {sample.name}
            </div>
            <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
              {sample.filename}
            </div>
          </div>
          <span className="category-badge" style={{
            background: cat?.darkColor,
            color: cat?.color,
            flexShrink: 0,
          }}>
            {cat?.label}
          </span>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ padding: '10px 14px' }}>
        <WaveformPlayer url={streamUrl} compact />
      </div>

      {/* Metadata */}
      <div style={{
        padding: '0 14px',
        flex: 1,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
          {[
            ['BPM', formatBpm(sample.bpm)],
            ['Key', sample.key || '—'],
            ['Type', sample.isLoop ? 'Loop' : 'One-shot'],
            ['Size', formatSize(sample.size)],
            ['Channels', '—'],
            ['Rate', '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#bbb' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #2a2a2a' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          block
          onClick={onAddToProject}
          style={{ background: '#ff681d', borderColor: '#ff681d' }}
        >
          Add to Project
        </Button>
      </div>
    </div>
  );
}

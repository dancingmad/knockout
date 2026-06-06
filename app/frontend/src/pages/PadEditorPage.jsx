import React, { useState, useEffect } from 'react';
import {
  Row, Col, Typography, Button, Select, Space, Tooltip,
  Popover, Slider, InputNumber, Form, Divider, Badge, Tag,
  Switch, Alert,
} from 'antd';
import {
  ClearOutlined, SaveOutlined, PlayCircleOutlined, SoundOutlined,
} from '@ant-design/icons';
import useStore from '../store';
import {
  PAD_GROUPS, SLOT_CATEGORIES, getCategoryForSlot, formatBpm, getCategoryById,
  midiNoteToName, truncatePadName,
} from '../utils/ko2';
import { audioApi } from '../utils/api';
import WaveformPlayer from '../components/WaveformPlayer';

const { Title, Text } = Typography;
const { Option } = Select;

// Pad layout: 3 rows × 4 columns (matching KO II physical layout)
// Group A: 7,8,9 / 4,5,6 / 1,2,3 (column-major, bottom-to-top)
// Visual order for 3×4 display:
const PAD_LAYOUT = [
  [7, 8, 9, null],   // row 1
  [4, 5, 6, null],   // row 2
  [1, 2, 3, null],   // row 3
  [10,11,12, null],  // row 4 (extra pads)
];

// Actual pad numbers: 1-12 in visual layout (3×4 grid)
// KO II: pads labeled A1-A12, B1-B12, C1-C12, D1-D12
// Physical layout (bottom-left = 1):
//  Row 4: 10 11 12
//  Row 3:  7  8  9  
//  Row 2:  4  5  6  
//  Row 1:  1  2  3  
const PAD_VISUAL_LAYOUT = [
  [10, 11, 12],
  [7, 8, 9],
  [4, 5, 6],
  [1, 2, 3],
];

export default function PadEditorPage() {
  const {
    projects, currentProject, projectLoading,
    loadProjects, loadProject, updatePad, savePads,
    updatePadsLocal,
  } = useStore();

  const [selectedPad, setSelectedPad] = useState(null); // { group, pad }
  const [activeGroup, setActiveGroup] = useState('a');

  useEffect(() => {
    loadProjects();
  }, []);

  const handleProjectChange = (id) => {
    loadProject(id);
    setSelectedPad(null);
  };

  const getPadConfig = (group, pad) => {
    if (!currentProject) return null;
    return (currentProject.padAssignments || []).find(
      a => a.group === group && a.pad === pad
    );
  };

  const handlePadClick = (group, pad) => {
    const existing = selectedPad;
    if (existing?.group === group && existing?.pad === pad) {
      setSelectedPad(null);
    } else {
      setSelectedPad({ group, pad });
    }
  };

  const handleAssignSlot = async (slot) => {
    if (!selectedPad || !currentProject) return;
    const { group, pad } = selectedPad;

    // Find sound info
    const sound = (currentProject.sounds || []).find(s => s.slot === slot);
    const config = {
      slot,
      inPoint: 0,
      outPoint: 0,
      bpm: sound?.bpm || 0,
      volume: 100,
      rootNote: 60,
      flags: 0xFF,
      loopFlag: sound?.isLoop ? 1 : 0,
    };

    await updatePad(group, pad, config);
  };

  const handleClearPad = async (group, pad) => {
    await updatePad(group, pad, {
      slot: 0,
      inPoint: 0,
      outPoint: 0,
      bpm: 0,
      volume: 100,
      rootNote: 60,
      flags: 0xFF,
      loopFlag: 0,
    });
  };

  const selectedPadConfig = selectedPad
    ? getPadConfig(selectedPad.group, selectedPad.pad)
    : null;

  const selectedPadSound = selectedPadConfig?.config?.slot
    ? (currentProject?.sounds || []).find(s => s.slot === selectedPadConfig.config.slot)
    : null;

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
      }}>
        <Title level={5} style={{ margin: 0, color: '#ff681d', fontSize: 11, letterSpacing: 2 }}>
          PAD EDITOR
        </Title>
        <div style={{ width: 1, height: 16, background: '#333', margin: '0 4px' }} />

        <Select
          placeholder="Select Project"
          style={{ width: 200 }}
          size="small"
          value={currentProject?.id}
          onChange={handleProjectChange}
        >
          {projects.map(p => (
            <Option key={p.id} value={p.id}>{p.name}</Option>
          ))}
        </Select>

        {currentProject && (
          <Button
            size="small"
            icon={<SaveOutlined />}
            onClick={savePads}
            style={{ marginLeft: 'auto' }}
          >
            Save Layout
          </Button>
        )}
      </div>

      {!currentProject ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#555',
        }}>
          Select a project to edit pad assignments
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: KO II Pad Grid */}
          <div style={{
            width: 480,
            flexShrink: 0,
            padding: 20,
            borderRight: '1px solid #2a2a2a',
            background: '#151515',
            overflow: 'auto',
          }}>
            {/* Device visualization */}
            <KO2DeviceView
              project={currentProject}
              activeGroup={activeGroup}
              selectedPad={selectedPad}
              onGroupChange={setActiveGroup}
              onPadClick={handlePadClick}
              getPadConfig={getPadConfig}
            />
          </div>

          {/* Center: Pad Config */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
          }}>
            {selectedPad ? (
              <PadConfigPanel
                group={selectedPad.group}
                pad={selectedPad.pad}
                config={selectedPadConfig?.config}
                sound={selectedPadSound}
                project={currentProject}
                onAssign={handleAssignSlot}
                onClear={() => handleClearPad(selectedPad.group, selectedPad.pad)}
                onUpdateConfig={async (config) => {
                  await updatePad(selectedPad.group, selectedPad.pad, config);
                }}
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', height: '100%',
                color: '#555', fontSize: 12,
              }}>
                Click a pad to configure it
              </div>
            )}
          </div>

          {/* Right: Sound Picker */}
          {selectedPad && (
            <div style={{
              width: 260,
              borderLeft: '1px solid #2a2a2a',
              overflow: 'auto',
              background: '#1a1a1a',
            }}>
              <SoundPicker
                project={currentProject}
                currentSlot={selectedPadConfig?.config?.slot}
                onSelect={handleAssignSlot}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KO II Device View ────────────────────────────────────────────────────────
function KO2DeviceView({ project, activeGroup, selectedPad, onGroupChange, onPadClick, getPadConfig }) {
  const group = PAD_GROUPS.find(g => g.id === activeGroup);

  return (
    <div>
      {/* Group selector tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 16,
      }}>
        {PAD_GROUPS.map(g => (
          <button
            key={g.id}
            onClick={() => onGroupChange(g.id)}
            style={{
              background: activeGroup === g.id ? g.color : '#2a2a2a',
              border: 'none',
              color: 'white',
              padding: '6px 20px',
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 13,
              letterSpacing: 1,
              transition: 'all 0.15s',
              opacity: activeGroup === g.id ? 1 : 0.5,
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* KO II style device frame */}
      <div style={{
        background: '#1c1c1c',
        borderRadius: 8,
        padding: 20,
        border: '1px solid #333',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        {/* Device header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div>
            <div style={{ color: '#ff681d', fontSize: 14, fontWeight: 'bold' }}>K.O. II</div>
            <div style={{ color: '#555', fontSize: 8 }}>サンプラー</div>
          </div>
          <div style={{
            color: group?.color,
            fontSize: 12,
            fontWeight: 'bold',
            letterSpacing: 2,
          }}>
            GROUP {activeGroup.toUpperCase()}
          </div>
        </div>

        {/* Pad grid (4 rows × 3 cols) */}
        <div style={{
          display: 'grid',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {PAD_VISUAL_LAYOUT.map((row, rowIdx) => (
            <div key={rowIdx} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {row.map(padNum => {
                const config = getPadConfig(activeGroup, padNum);
                const hasSound = config?.config?.slot > 0;
                const sound = hasSound
                  ? (project?.sounds || []).find(s => s.slot === config.config.slot)
                  : null;
                const isSelected = selectedPad?.group === activeGroup && selectedPad?.pad === padNum;
                const cat = hasSound ? getCategoryForSlot(config.config.slot) : null;

                return (
                  <KO2Pad
                    key={padNum}
                    padNum={padNum}
                    group={activeGroup}
                    groupColor={group?.color}
                    sound={sound}
                    category={cat}
                    config={config?.config}
                    isSelected={isSelected}
                    onClick={() => onPadClick(activeGroup, padNum)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Group dots (like on real device) */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          gap: 6,
          marginTop: 12,
          paddingLeft: 4,
        }}>
          {PAD_GROUPS.map(g => (
            <div
              key={g.id}
              onClick={() => onGroupChange(g.id)}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: g.id === activeGroup ? g.color : '#333',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* All groups overview */}
      <div style={{ marginTop: 16 }}>
        <div style={{ color: '#555', fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>
          ALL GROUPS OVERVIEW
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {PAD_GROUPS.map(g => {
            const assignments = (project?.padAssignments || []).filter(
              a => a.group === g.id && a.config?.slot > 0
            );
            return (
              <div
                key={g.id}
                onClick={() => onGroupChange(g.id)}
                style={{
                  background: '#1e1e1e',
                  border: `1px solid ${activeGroup === g.id ? g.color : '#2a2a2a'}`,
                  borderRadius: 4,
                  padding: '6px 8px',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{
                    fontWeight: 'bold',
                    color: g.color,
                    fontSize: 11,
                  }}>
                    {g.label}
                  </span>
                  <span style={{ fontSize: 9, color: '#555' }}>
                    {assignments.length}/12
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: 2,
                  marginTop: 4,
                  flexWrap: 'wrap',
                }}>
                  {Array.from({ length: 12 }, (_, i) => {
                    const a = assignments.find(x => x.pad === i + 1);
                    return (
                      <div
                        key={i}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 1,
                          background: a ? g.color : '#2a2a2a',
                          opacity: a ? 0.8 : 0.3,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── KO2 Pad ──────────────────────────────────────────────────────────────────
function KO2Pad({ padNum, group, groupColor, sound, category, config, isSelected, onClick }) {
  const hasSound = config?.slot > 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: hasSound
          ? (isSelected ? '#2a2a2a' : '#222')
          : (isSelected ? '#1e1e1e' : '#181818'),
        border: isSelected
          ? `2px solid ${groupColor}`
          : hasSound
            ? `1px solid ${category?.color || '#444'}44`
            : '1px solid #252525',
        borderRadius: 4,
        padding: '8px 6px',
        cursor: 'pointer',
        minHeight: 70,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.1s',
        position: 'relative',
        boxShadow: isSelected ? `0 0 8px ${groupColor}44` : 'none',
      }}
    >
      {/* Category color bar */}
      {hasSound && category && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: category.color,
          opacity: 0.7,
          borderRadius: '4px 4px 0 0',
        }} />
      )}

      {/* Pad number */}
      <div style={{
        fontSize: 8,
        color: isSelected ? groupColor : '#444',
        fontWeight: 'bold',
      }}>
        {group.toUpperCase()}{padNum}
      </div>

      {/* Sound name */}
      {hasSound && sound ? (
        <div>
          <div style={{
            fontSize: 9,
            color: '#ccc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}>
            {truncatePadName(sound.name)}
          </div>
          <div style={{ fontSize: 8, color: '#555', marginTop: 1 }}>
            #{config.slot}
          </div>
        </div>
      ) : (
        <div style={{
          fontSize: 8,
          color: '#333',
          textAlign: 'center',
        }}>
          EMPTY
        </div>
      )}

      {/* Volume indicator */}
      {hasSound && config?.volume !== undefined && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          fontSize: 7,
          color: '#444',
        }}>
          {config.volume}
        </div>
      )}
    </div>
  );
}

// ─── Pad Config Panel ─────────────────────────────────────────────────────────
function PadConfigPanel({ group, pad, config, sound, project, onAssign, onClear, onUpdateConfig }) {
  const [localConfig, setLocalConfig] = useState(config || {});

  useEffect(() => {
    setLocalConfig(config || {});
  }, [config, group, pad]);

  const handleSave = () => {
    onUpdateConfig(localConfig);
  };

  const hasSound = config?.slot > 0;
  const cat = hasSound ? getCategoryForSlot(config.slot) : null;
  const groupInfo = PAD_GROUPS.find(g => g.id === group);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <span style={{
            fontWeight: 'bold',
            fontSize: 14,
            color: groupInfo?.color,
          }}>
            {group.toUpperCase()}{pad}
          </span>
          <span style={{ fontSize: 10, color: '#666', marginLeft: 8 }}>
            {hasSound ? `Slot ${config.slot}` : 'Empty'}
          </span>
        </div>
        <Space>
          {hasSound && (
            <Button
              size="small"
              danger
              icon={<ClearOutlined />}
              onClick={onClear}
            >
              Clear
            </Button>
          )}
          {hasSound && (
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              style={{ background: '#ff681d', borderColor: '#ff681d' }}
            >
              Save
            </Button>
          )}
        </Space>
      </div>

      {hasSound ? (
        <div>
          {/* Sound info */}
          <div style={{
            background: '#111',
            borderRadius: 4,
            padding: '8px 12px',
            marginBottom: 16,
            border: `1px solid ${cat?.color || '#333'}44`,
          }}>
            <div style={{ fontSize: 12, color: '#eee', fontWeight: 'bold' }}>
              {sound?.name || `Slot ${config.slot}`}
            </div>
            <div style={{ fontSize: 9, color: '#555' }}>
              {sound?.filename} · {cat?.label} · {formatBpm(sound?.bpm)}
            </div>
          </div>

          {/* Pad settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Volume */}
            <Form.Item label="Volume" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Slider
                  min={0}
                  max={100}
                  value={localConfig.volume ?? 100}
                  onChange={v => setLocalConfig(c => ({ ...c, volume: v }))}
                  style={{ flex: 1 }}
                  size="small"
                />
                <span style={{ fontSize: 11, color: '#aaa', width: 28 }}>
                  {localConfig.volume ?? 100}
                </span>
              </div>
            </Form.Item>

            {/* Root Note */}
            <Form.Item label="Root Note" style={{ marginBottom: 0 }}>
              <Select
                size="small"
                value={localConfig.rootNote ?? 60}
                onChange={v => setLocalConfig(c => ({ ...c, rootNote: v }))}
                style={{ width: '100%' }}
              >
                {Array.from({ length: 128 }, (_, i) => (
                  <Option key={i} value={i}>{midiNoteToName(i)}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* IN point */}
            <Form.Item label="IN Point (samples)" style={{ marginBottom: 0 }}>
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                value={localConfig.inPoint ?? 0}
                onChange={v => setLocalConfig(c => ({ ...c, inPoint: v || 0 }))}
              />
            </Form.Item>

            {/* OUT point */}
            <Form.Item label="OUT Point (samples)" style={{ marginBottom: 0 }}>
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                value={localConfig.outPoint ?? 0}
                onChange={v => setLocalConfig(c => ({ ...c, outPoint: v || 0 }))}
                placeholder="0 = auto"
              />
            </Form.Item>

            {/* Loop */}
            <Form.Item label="Loop Mode" style={{ marginBottom: 0 }}>
              <Switch
                size="small"
                checked={!!localConfig.loopFlag}
                onChange={v => setLocalConfig(c => ({ ...c, loopFlag: v ? 1 : 0 }))}
              />
            </Form.Item>
          </div>

          {/* Waveform preview */}
          {sound && (
            <div style={{ marginTop: 16 }}>
              <WaveformPlayer
                url={audioApi.getStreamUrl(sound.originalPath || sound.optimizedPath)}
              />
            </div>
          )}
        </div>
      ) : (
        <Alert
          message="No sample assigned"
          description="Select a sample from the Sound Picker on the right to assign to this pad."
          type="info"
          style={{ background: '#1a1a1a', border: '1px solid #333' }}
        />
      )}
    </div>
  );
}

// ─── Sound Picker ─────────────────────────────────────────────────────────────
function SoundPicker({ project, currentSlot, onSelect }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState(null);

  const sounds = (project?.sounds || []).filter(s => {
    if (!s.slot) return false;
    if (catFilter) {
      const cat = getCategoryForSlot(s.slot);
      if (cat?.id !== catFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || String(s.slot).includes(q);
    }
    return true;
  });

  return (
    <div style={{ padding: 12 }}>
      <div style={{
        fontSize: 9,
        color: '#666',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        Sound Picker
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <Select
          size="small"
          style={{ flex: 1 }}
          placeholder="Category"
          allowClear
          value={catFilter}
          onChange={setCatFilter}
        >
          {SLOT_CATEGORIES.map(cat => (
            <Option key={cat.id} value={cat.id}>
              <span style={{
                width: 8, height: 8,
                borderRadius: 2,
                background: cat.color,
                display: 'inline-block',
                marginRight: 4,
              }} />
              {cat.label}
            </Option>
          ))}
        </Select>
      </div>

      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%',
          background: '#111',
          border: '1px solid #333',
          borderRadius: 3,
          color: '#ccc',
          padding: '4px 8px',
          fontSize: 11,
          marginBottom: 8,
          outline: 'none',
        }}
      />

      {sounds.length === 0 ? (
        <div style={{ color: '#555', fontSize: 10, textAlign: 'center', padding: '20px 0' }}>
          No sounds in project
        </div>
      ) : (
        <div>
          {sounds.map(sound => {
            const cat = getCategoryForSlot(sound.slot);
            const isActive = currentSlot === sound.slot;

            return (
              <div
                key={sound.slot}
                onClick={() => onSelect(sound.slot)}
                style={{
                  padding: '5px 8px',
                  cursor: 'pointer',
                  borderRadius: 3,
                  marginBottom: 2,
                  background: isActive ? '#2a2a2a' : '#161616',
                  border: isActive ? `1px solid ${cat?.color || '#ff681d'}88` : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{
                  width: 4,
                  height: 24,
                  borderRadius: 2,
                  background: cat?.color || '#666',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{
                    fontSize: 10,
                    color: '#ddd',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {sound.name}
                  </div>
                  <div style={{ fontSize: 8, color: '#555' }}>
                    #{sound.slot} · {cat?.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Row, Col, Typography, Button, Select, Input, Space, Tag,
  Tooltip, Popconfirm, Alert, Spin, Modal, Form, InputNumber,
  Divider, Badge,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined,
  ExportOutlined, SoundOutlined, FolderOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import useStore from '../store';
import {
  SLOT_CATEGORIES, getCategoryById, getCategoryForSlot,
  formatSize, formatBpm, formatDuration, getNextFreeSlot,
} from '../utils/ko2';
import { audioApi } from '../utils/api';
import WaveformPlayer from '../components/WaveformPlayer';

const { Title, Text } = Typography;
const { Option } = Select;

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SongBuilderPage() {
  const {
    projects, currentProject, projectLoading,
    loadProjects, loadProject, createProject, updateProject,
    removeSoundFromProject, exportProject, exporting,
  } = useStore();

  const [newProjectModal, setNewProjectModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleProjectChange = (id) => {
    loadProject(id);
    setSelectedSlot(null);
  };

  const slotMap = {};
  (currentProject?.sounds || []).forEach(s => { slotMap[s.slot] = s; });

  const selectedSound = selectedSlot ? slotMap[selectedSlot] : null;

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
          SONG BUILDER
        </Title>
        <div style={{ width: 1, height: 16, background: '#333', margin: '0 4px' }} />

        {/* Project selector */}
        <Select
          placeholder="Select Project"
          style={{ width: 200 }}
          size="small"
          value={currentProject?.id}
          onChange={handleProjectChange}
          notFoundContent="No projects yet"
        >
          {projects.map(p => (
            <Option key={p.id} value={p.id}>{p.name}</Option>
          ))}
        </Select>

        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setNewProjectModal(true)}
        >
          New
        </Button>

        {currentProject && (
          <>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#666' }}>
                {(currentProject.sounds || []).length} sounds
              </Text>
              <Divider type="vertical" />
              <Text style={{ fontSize: 10, color: '#666' }}>
                BPM: {currentProject.bpm || '—'}
              </Text>
              <Button
                size="small"
                type="primary"
                icon={<ExportOutlined />}
                loading={exporting}
                onClick={() => exportProject(currentProject.id)}
                style={{ background: '#ff681d', borderColor: '#ff681d' }}
              >
                Export ppak
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Main layout */}
      {!currentProject ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          color: '#666',
        }}>
          <AppstoreOutlined style={{ fontSize: 48, color: '#333' }} />
          <div style={{ fontSize: 12 }}>Select or create a project to start building</div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setNewProjectModal(true)}
            style={{ background: '#ff681d', borderColor: '#ff681d' }}
          >
            Create New Project
          </Button>
        </div>
      ) : projectLoading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Category nav + slot grid */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Category sidebar */}
            <div style={{
              width: 90,
              borderRight: '1px solid #2a2a2a',
              background: '#111',
              overflow: 'auto',
              flexShrink: 0,
            }}>
              <div
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  fontSize: 9,
                  color: !activeCategory ? '#ff681d' : '#666',
                  background: !activeCategory ? '#1e1e1e' : 'transparent',
                  borderBottom: '1px solid #1e1e1e',
                  letterSpacing: 1,
                }}
                onClick={() => setActiveCategory(null)}
              >
                ALL
              </div>
              {SLOT_CATEGORIES.map(cat => {
                const count = (currentProject.sounds || []).filter(
                  s => s.slot >= cat.range[0] && s.slot <= cat.range[1]
                ).length;
                const isActive = activeCategory === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #1a1a1a',
                      background: isActive ? '#1e1e1e' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 2,
                    }}>
                      <span style={{
                        fontSize: 8,
                        fontWeight: 'bold',
                        color: isActive ? cat.color : '#888',
                        letterSpacing: 1,
                      }}>
                        {cat.label}
                      </span>
                      {count > 0 && (
                        <span style={{
                          fontSize: 8,
                          background: cat.darkColor,
                          color: cat.color,
                          padding: '0 3px',
                          borderRadius: 2,
                        }}>
                          {count}
                        </span>
                      )}
                    </div>
                    <div style={{
                      height: 2,
                      background: isActive ? cat.color : '#222',
                      borderRadius: 1,
                    }} />
                    <div style={{ fontSize: 7, color: '#444', marginTop: 2 }}>
                      {cat.range[0]}–{cat.range[1]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slot grid */}
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <SlotGrid
                project={currentProject}
                slotMap={slotMap}
                activeCategory={activeCategory}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
                onRemoveSound={removeSoundFromProject}
              />
            </div>
          </div>

          {/* Right: Sound detail */}
          {selectedSound && (
            <div style={{
              width: 300,
              borderLeft: '1px solid #2a2a2a',
              background: '#1a1a1a',
              overflow: 'auto',
            }}>
              <SoundDetail
                sound={selectedSound}
                slot={selectedSlot}
                onRemove={() => {
                  removeSoundFromProject(selectedSlot);
                  setSelectedSlot(null);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        open={newProjectModal}
        onClose={() => setNewProjectModal(false)}
        onCreate={async (data) => {
          await createProject(data);
          setNewProjectModal(false);
        }}
      />
    </div>
  );
}

// ─── Slot Grid ────────────────────────────────────────────────────────────────
function SlotGrid({ project, slotMap, activeCategory, selectedSlot, onSelectSlot, onRemoveSound }) {
  // Get categories to show
  const categories = activeCategory
    ? SLOT_CATEGORIES.filter(c => c.id === activeCategory)
    : SLOT_CATEGORIES;

  return (
    <div>
      {categories.map(cat => (
        <div key={cat.id} style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            <div style={{ width: 3, height: 14, background: cat.color, borderRadius: 1 }} />
            <span style={{
              fontSize: 10,
              fontWeight: 'bold',
              color: cat.color,
              letterSpacing: 2,
            }}>
              {cat.label}
            </span>
            <span style={{ fontSize: 9, color: '#444' }}>
              {cat.range[0]} – {cat.range[1]}
            </span>
          </div>

          <div className="slot-grid">
            {Array.from({ length: cat.range[1] - cat.range[0] + 1 }, (_, i) => {
              const slot = cat.range[0] + i;
              const sound = slotMap[slot];
              return (
                <SlotCell
                  key={slot}
                  slot={slot}
                  sound={sound}
                  cat={cat}
                  selected={selectedSlot === slot}
                  onClick={() => onSelectSlot(slot === selectedSlot ? null : slot)}
                  onRemove={() => {
                    if (sound) onRemoveSound(slot);
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Slot Cell ────────────────────────────────────────────────────────────────
function SlotCell({ slot, sound, cat, selected, onClick, onRemove }) {
  return (
    <Tooltip title={sound ? `${slot}: ${sound.name}` : `Slot ${slot} (empty)`} mouseEnterDelay={0.5}>
      <div
        className={`slot-cell ${sound ? 'occupied' : ''}`}
        onClick={onClick}
        style={{
          borderColor: selected ? '#ff681d' : sound ? '#333' : '#2a2a2a',
          background: selected ? '#1e1e1e' : sound ? '#1e1e1e' : '#161616',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {/* Slot indicator bar */}
        {sound && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: cat.color,
            opacity: 0.6,
          }} />
        )}

        <div className="slot-number" style={{ color: sound ? '#666' : '#333' }}>
          {slot}
        </div>

        {sound ? (
          <div className="slot-name" style={{ color: '#ccc' }}>
            {sound.name}
          </div>
        ) : (
          <div style={{ height: 14 }} />
        )}

        {sound && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 2,
          }}>
            <span style={{ fontSize: 8, color: '#555' }}>
              {formatBpm(sound.bpm)}
            </span>
            <Popconfirm
              title="Remove this sample?"
              onConfirm={(e) => { e.stopPropagation(); onRemove(); }}
              onCancel={(e) => e.stopPropagation()}
              okText="Remove"
              okButtonProps={{ danger: true, size: 'small' }}
              cancelButtonProps={{ size: 'small' }}
            >
              <DeleteOutlined
                style={{ fontSize: 9, color: '#444', cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </div>
        )}
      </div>
    </Tooltip>
  );
}

// ─── Sound Detail ─────────────────────────────────────────────────────────────
function SoundDetail({ sound, slot, onRemove }) {
  const cat = getCategoryForSlot(slot);
  const streamUrl = audioApi.getStreamUrl(sound.originalPath || sound.optimizedPath);

  return (
    <div style={{ padding: 14 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#eee', fontWeight: 'bold' }}>
            {sound.name}
          </div>
          <div style={{ fontSize: 9, color: '#555' }}>Slot {slot}</div>
        </div>
        <Popconfirm
          title="Remove this sample from the project?"
          onConfirm={onRemove}
          okText="Remove"
          okButtonProps={{ danger: true, size: 'small' }}
          cancelButtonProps={{ size: 'small' }}
        >
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      </div>

      {/* Waveform */}
      <div style={{ marginBottom: 12 }}>
        <WaveformPlayer url={streamUrl} />
      </div>

      {/* Metadata grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px 12px',
        marginBottom: 12,
      }}>
        {[
          ['Slot', slot],
          ['Category', cat?.label],
          ['BPM', formatBpm(sound.bpm)],
          ['Key', sound.key || '—'],
          ['Type', sound.isLoop ? 'Loop' : 'One-shot'],
          ['Size', formatSize(sound.size)],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 11, color: '#bbb' }}>{value}</div>
          </div>
        ))}
      </div>

      <Divider style={{ borderColor: '#2a2a2a', margin: '8px 0' }} />

      <div style={{ fontSize: 9, color: '#444', wordBreak: 'break-all' }}>
        {sound.filename}
      </div>
    </div>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ open, onClose, onCreate }) {
  const [form] = Form.useForm();

  return (
    <Modal
      open={open}
      title={<span style={{ color: '#ff681d', fontSize: 12 }}>NEW PROJECT</span>}
      onCancel={onClose}
      footer={null}
      width={360}
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        onFinish={async (values) => {
          await onCreate(values);
          form.resetFields();
        }}
        initialValues={{ bpm: 120 }}
      >
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input placeholder="My Song" />
        </Form.Item>
        <Form.Item label="BPM" name="bpm">
          <InputNumber min={60} max={200} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Key" name="key">
          <Input placeholder="e.g. Cmin, F#maj" />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={2} placeholder="Optional description..." />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{ background: '#ff681d', borderColor: '#ff681d' }}
            >
              Create
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

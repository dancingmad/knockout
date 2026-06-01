import React, { useState, useRef } from 'react';
import {
  Row, Col, Typography, Button, Upload, Table, Tag,
  Alert, Space, Descriptions, Progress, Divider, Modal,
  Input, message, Card, Statistic,
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, ImportOutlined, ExportOutlined,
  InboxOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import useStore from '../store';
import { importApi, exportApi, audioApi } from '../utils/api';
import { formatSize, getCategoryForSlot, downloadBlob } from '../utils/ko2';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function ImportExportPage() {
  const {
    currentProject, projects, loadProject,
    exportProject, importPpak,
    exporting, importing,
  } = useStore();

  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importName, setImportName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [optimizeResults, setOptimizeResults] = useState(null);

  const handlePreview = async (file) => {
    setPreviewLoading(true);
    setPendingFile(file);
    try {
      const res = await importApi.previewPpak(file);
      setPreviewData(res.data);
      setImportName(file.name.replace(/_backup\.ppak$/, '').replace(/\.ppak$/, ''));
    } catch (e) {
      message.error('Failed to read ppak file: ' + e.message);
    } finally {
      setPreviewLoading(false);
    }
    return false; // prevent auto-upload
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    try {
      const project = await importPpak(pendingFile, importName);
      message.success(`Imported "${project.name}" successfully`);
      setPreviewData(null);
      setPendingFile(null);
    } catch (e) {
      message.error('Import failed: ' + e.message);
    }
  };

  const handleExport = async (projectId) => {
    try {
      await exportProject(projectId);
      message.success('ppak exported successfully');
    } catch (e) {
      message.error('Export failed: ' + e.message);
    }
  };

  const handleOptimize = async () => {
    if (!currentProject) return;
    setOptimizeLoading(true);
    try {
      const res = await audioApi.optimizeProject(currentProject.id);
      setOptimizeResults(res.data.results);
      message.success('Samples optimized successfully');
    } catch (e) {
      message.error('Optimization failed: ' + e.message);
    } finally {
      setOptimizeLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Title level={4} style={{ color: '#ff681d', letterSpacing: 2, fontSize: 13 }}>
        IMPORT / EXPORT
      </Title>

      <Row gutter={24}>
        {/* LEFT: Import */}
        <Col span={12}>
          <Card
            title={
              <span style={{ color: '#ff681d', fontSize: 11, letterSpacing: 2 }}>
                <ImportOutlined /> IMPORT ppak
              </span>
            }
            style={{ background: '#1a1a1a', border: '1px solid #333', marginBottom: 16 }}
          >
            <Dragger
              accept=".ppak"
              beforeUpload={handlePreview}
              showUploadList={false}
              style={{ background: '#111', border: '1px dashed #333' }}
            >
              <p style={{ color: '#555' }}>
                <InboxOutlined style={{ fontSize: 32, color: '#444' }} />
              </p>
              <p style={{ color: '#666', fontSize: 11 }}>
                Drop a .ppak backup file here
              </p>
              <p style={{ color: '#444', fontSize: 10 }}>
                Exported from ep-sample-tool or Knockout
              </p>
            </Dragger>

            {previewLoading && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#666' }}>
                Reading ppak file...
              </div>
            )}

            {previewData && (
              <div style={{ marginTop: 16 }}>
                <Divider style={{ borderColor: '#2a2a2a' }} />

                {/* Device info */}
                <div style={{
                  background: '#111',
                  borderRadius: 4,
                  padding: '8px 12px',
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>DEVICE INFO</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>
                    {previewData.meta?.device_name} · v{previewData.meta?.device_version}
                  </div>
                  <div style={{ fontSize: 9, color: '#555' }}>
                    {previewData.meta?.generated_at?.slice(0, 10)}
                  </div>
                </div>

                {/* Stats */}
                <Row gutter={8} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <Statistic
                      title="Sounds"
                      value={previewData.stats?.soundCount || 0}
                      valueStyle={{ fontSize: 18, color: '#ff681d' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Pads"
                      value={previewData.stats?.padCount || 0}
                      suffix="/48"
                      valueStyle={{ fontSize: 18, color: '#42a5f5' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Patterns"
                      value={previewData.patterns?.length || 0}
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                </Row>

                {/* Sound list preview */}
                {previewData.sounds?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>SOUNDS</div>
                    <div style={{ maxHeight: 160, overflow: 'auto' }}>
                      {previewData.sounds.slice(0, 20).map(s => {
                        const cat = getCategoryForSlot(s.slot);
                        return (
                          <div key={s.slot} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '2px 0',
                            fontSize: 10,
                            borderBottom: '1px solid #1a1a1a',
                          }}>
                            <span style={{ color: '#555', width: 24, flexShrink: 0 }}>
                              {s.slot}
                            </span>
                            <span style={{
                              background: cat?.darkColor,
                              color: cat?.color,
                              padding: '0 3px',
                              borderRadius: 2,
                              fontSize: 8,
                              flexShrink: 0,
                            }}>
                              {cat?.label}
                            </span>
                            <span style={{
                              color: '#bbb',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {s.name}
                            </span>
                            <span style={{ color: '#444', fontSize: 9, marginLeft: 'auto', flexShrink: 0 }}>
                              {formatSize(s.size)}
                            </span>
                          </div>
                        );
                      })}
                      {previewData.sounds.length > 20 && (
                        <div style={{ color: '#555', fontSize: 9, padding: '4px 0' }}>
                          +{previewData.sounds.length - 20} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Import name */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>PROJECT NAME</div>
                  <Input
                    size="small"
                    value={importName}
                    onChange={e => setImportName(e.target.value)}
                    placeholder="Project name"
                  />
                </div>

                <Button
                  type="primary"
                  block
                  icon={<ImportOutlined />}
                  onClick={handleImport}
                  loading={importing}
                  style={{ background: '#ff681d', borderColor: '#ff681d' }}
                >
                  Import Project
                </Button>
              </div>
            )}
          </Card>
        </Col>

        {/* RIGHT: Export */}
        <Col span={12}>
          <Card
            title={
              <span style={{ color: '#42a5f5', fontSize: 11, letterSpacing: 2 }}>
                <ExportOutlined /> EXPORT ppak
              </span>
            }
            style={{ background: '#1a1a1a', border: '1px solid #333', marginBottom: 16 }}
          >
            {projects.length === 0 ? (
              <Alert message="No projects yet" type="info" />
            ) : (
              <div>
                {projects.map(project => {
                  const soundCount = (project.sounds || []).length;
                  const padCount = (project.padAssignments || []).filter(
                    a => a.config?.slot > 0
                  ).length;

                  return (
                    <div key={project.id} style={{
                      background: '#111',
                      borderRadius: 4,
                      padding: '10px 12px',
                      marginBottom: 8,
                      border: '1px solid #2a2a2a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#eee', fontWeight: 'bold' }}>
                          {project.name}
                        </div>
                        <div style={{ fontSize: 9, color: '#555' }}>
                          {soundCount} sounds · {padCount}/48 pads
                          {project.bpm ? ` · ${project.bpm} BPM` : ''}
                          {project.key ? ` · ${project.key}` : ''}
                        </div>
                      </div>
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => handleExport(project.id)}
                        loading={exporting}
                      >
                        Export
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Optimize */}
          <Card
            title={
              <span style={{ color: '#8bc34a', fontSize: 11, letterSpacing: 2 }}>
                ⚡ OPTIMIZE SAMPLES
              </span>
            }
            style={{ background: '#1a1a1a', border: '1px solid #333' }}
          >
            <div style={{ fontSize: 10, color: '#777', marginBottom: 12 }}>
              Convert all project samples to device format:
              46875 Hz, 16-bit PCM. Drums → mono, Melody/Loops → stereo.
            </div>

            {currentProject ? (
              <div>
                <div style={{
                  fontSize: 11,
                  color: '#aaa',
                  marginBottom: 8,
                }}>
                  Project: <strong style={{ color: '#eee' }}>{currentProject.name}</strong>
                  <span style={{ color: '#555', marginLeft: 8, fontSize: 9 }}>
                    ({(currentProject.sounds || []).length} sounds)
                  </span>
                </div>

                <Button
                  block
                  icon={<span>⚡</span>}
                  onClick={handleOptimize}
                  loading={optimizeLoading}
                  style={{
                    background: '#1e3a1e',
                    borderColor: '#2a5a2a',
                    color: '#8bc34a',
                  }}
                >
                  Optimize All Samples
                </Button>

                {optimizeResults && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 9, color: '#555', marginBottom: 4 }}>
                      RESULTS
                    </div>
                    {optimizeResults.map((r, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10,
                        padding: '2px 0',
                      }}>
                        {r.success
                          ? <CheckCircleOutlined style={{ color: '#8bc34a' }} />
                          : <WarningOutlined style={{ color: '#ff4444' }} />
                        }
                        <span style={{ color: r.success ? '#aaa' : '#ff4444' }}>
                          Slot {r.slot}: {r.success ? 'OK' : r.error}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Alert
                message="Select a project in Song Builder first"
                type="info"
                style={{ background: '#1a1a1a', border: '1px solid #333' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Instructions */}
      <Card
        title={
          <span style={{ color: '#888', fontSize: 11, letterSpacing: 2 }}>
            📖 HOW TO USE
          </span>
        }
        style={{ background: '#111', border: '1px solid #2a2a2a', marginTop: 0 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ color: '#ff681d', fontSize: 10, marginBottom: 6, fontWeight: 'bold' }}>
              WORKFLOW
            </div>
            <ol style={{ color: '#666', fontSize: 10, paddingLeft: 16, lineHeight: 2 }}>
              <li>Browse samples in the Library tab</li>
              <li>Create a project in Song Builder</li>
              <li>Add samples to slots (kick=1-99, snare=100-199, etc.)</li>
              <li>Assign slots to pads A/B/C/D in Pad Editor</li>
              <li>Optimize samples for device format</li>
              <li>Export as .ppak and load via ep-sample-tool</li>
            </ol>
          </div>
          <div>
            <div style={{ color: '#42a5f5', fontSize: 10, marginBottom: 6, fontWeight: 'bold' }}>
              UPLOAD TO DEVICE
            </div>
            <ol style={{ color: '#666', fontSize: 10, paddingLeft: 16, lineHeight: 2 }}>
              <li>Connect KO II via USB-C</li>
              <li>Open <a href="https://teenage.engineering/apps/ep-sample-tool" target="_blank" rel="noreferrer" style={{ color: '#42a5f5' }}>ep-sample-tool</a></li>
              <li>Click "BACKUP &amp; RESTORE"</li>
              <li>Choose "Restore" and select your .ppak</li>
              <li>Wait for upload to complete</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}

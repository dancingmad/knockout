import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, 
  Card, 
  Select, 
  InputNumber, 
  Button, 
  Tooltip, 
  Badge, 
  Space,
  Typography,
  Divider,
  Switch,
  Slider,
  Row,
  Col,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  ClearOutlined,
  SaveOutlined,
  ExportOutlined,
  AudioOutlined,
} from '@ant-design/icons';
import useStore from '../store';

const { Header, Content } = Layout;
const { Text, Title } = Typography;

// EP-133 has 4 groups (A, B, C, D) with 12 pads each
const GROUPS = ['A', 'B', 'C', 'D'];
const PADS_PER_GROUP = 12;
const MAX_STEPS = 64;
const DEFAULT_STEPS = 16;

// Generate step numbers (1-indexed for display)
const generateStepNumbers = (numSteps) => 
  Array.from({ length: numSteps }, (_, i) => i + 1);

function SequencerPage() {
  const { 
    activeProject, 
    projects, 
    setActiveProject,
    loadProjects 
  } = useStore();
  
  // Sequencer state
  const [numSteps, setNumSteps] = useState(DEFAULT_STEPS);
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(120);
  
  // Grid state: 4 groups × 12 pads × 64 steps
  // Each cell: { active: boolean, velocity: number }
  const [grid, setGrid] = useState(() => {
    const initialGrid = {};
    GROUPS.forEach(group => {
      initialGrid[group] = {};
      for (let pad = 1; pad <= PADS_PER_GROUP; pad++) {
        initialGrid[group][pad] = {};
        for (let step = 1; step <= MAX_STEPS; step++) {
          initialGrid[group][pad][step] = { active: false, velocity: 100 };
        }
      }
    });
    return initialGrid;
  });
  
  // Load sequence from project if available
  useEffect(() => {
    if (activeProject?.sequence) {
      // TODO: Load sequence data from project
    }
  }, [activeProject]);

  // Generate step numbers for current length
  const stepNumbers = useMemo(() => generateStepNumbers(numSteps), [numSteps]);

  // Toggle pad at step
  const togglePad = (group, pad, step) => {
    setGrid(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [pad]: {
          ...prev[group][pad],
          [step]: {
            ...prev[group][pad][step],
            active: !prev[group][pad][step].active
          }
        }
      }
    }));
  };
  
  // Set velocity for pad at step
  const setVelocity = (group, pad, step, velocity) => {
    setGrid(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [pad]: {
          ...prev[group][pad],
          [step]: {
            ...prev[group][pad][step],
            velocity
          }
        }
      }
    }));
  };

  // Clear all steps in current view
  const clearGroup = (group) => {
    setGrid(prev => {
      const newGroup = { ...prev[group] };
      for (let pad = 1; pad <= PADS_PER_GROUP; pad++) {
        newGroup[pad] = {};
        for (let step = 1; step <= numSteps; step++) {
          newGroup[pad][step] = { active: false, velocity: 100 };
        }
      }
      return { ...prev, [group]: newGroup };
    });
  };
  
  // Clear entire grid
  const clearAll = () => {
    const initialGrid = {};
    GROUPS.forEach(group => {
      initialGrid[group] = {};
      for (let pad = 1; pad <= PADS_PER_GROUP; pad++) {
        initialGrid[group][pad] = {};
        for (let step = 1; step <= MAX_STEPS; step++) {
          initialGrid[group][pad][step] = { active: false, velocity: 100 };
        }
      }
    });
    setGrid(initialGrid);
  };
  
  // Play/pause sequencer
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentStep(0);
    } else {
      setIsPlaying(true);
    }
  };

  // Step advance (simplified - real one would use audio timing)
  useEffect(() => {
    let interval;
    if (isPlaying) {
      const stepTime = (60000 / bpm) / 4; // 16th notes
      interval = setInterval(() => {
        setCurrentStep(prev => (prev % numSteps) + 1);
      }, stepTime);
    }
    return () => clearInterval(interval);
  }, [isPlaying, bpm, numSteps]);

  // Get pad name from slot if available
  const getPadName = (group, pad) => {
    if (!activeProject?.padAssignments) return `${pad}`;
    
    const assignment = activeProject.padAssignments.find(
      a => a.group === group.toLowerCase() && a.pad === pad && a.config?.slot
    );
    
    if (!assignment?.config?.slot) return `${pad}`;
    
    const sound = activeProject.sounds?.find(s => s.slot === assignment.config.slot);
    return sound ? `${pad}: ${sound.name?.slice(0, 12)}` : `${pad}`;
  };
  
  // Count active steps
  const countActiveSteps = (group) => {
    let count = 0;
    for (let pad = 1; pad <= PADS_PER_GROUP; pad++) {
      for (let step = 1; step <= numSteps; step++) {
        if (grid[group][pad][step]?.active) count++;
      }
    }
    return count;
  };

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      {/* Toolbar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Text strong>Project:</Text>
              <Select
                style={{ width: 200 }}
                value={activeProject?.id}
                onChange={setActiveProject}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
              />
            </Space>
          </Col>
          <Col>
            <Divider type="vertical" />
          </Col>
          <Col>
            <Space>
              <Text>Steps:</Text>
              <InputNumber
                min={1}
                max={MAX_STEPS}
                value={numSteps}
                onChange={v => setNumSteps(v || 16)}
                style={{ width: 70 }}
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Text>BPM:</Text>
              <InputNumber
                min={30}
                max={300}
                value={bpm}
                onChange={setBpm}
                style={{ width: 70 }}
              />
            </Space>
          </Col>
          <Col>
            <Divider type="vertical" />
          </Col>
          <Col>
            <Space>
              <Button 
                icon={<PlayCircleOutlined />} 
                type={isPlaying ? 'default' : 'primary'}
                onClick={togglePlay}
              >
                {isPlaying ? 'Playing' : 'Play'}
              </Button>
              <Button 
                icon={<StepForwardOutlined />}
                onClick={() => setCurrentStep(s => s % numSteps + 1)}
                disabled={!isPlaying}
              >
                Step
              </Button>
            </Space>
          </Col>
          <Col style={{ marginLeft: 'auto' }}>
            <Space>
              <Button 
                icon={<ClearOutlined />} 
                danger
                onClick={clearAll}
              >
                Clear All
              </Button>
              <Button icon={<SaveOutlined />}>
                Save
              </Button>
              <Button icon={<ExportOutlined />}>
                Export
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* Main Sequencer Grid */}
        <Col flex={1}>
          <Card 
            size="small" 
            title={
              <Space>
                <span>Sequencer</span>
                <Badge 
                  count={`${countActiveSteps(selectedGroup)} notes`} 
                  style={{ backgroundColor: '#ff681d' }}
                />
              </Space>
            }
            extra={
              <Space>
                {GROUPS.map(g => (
                  <Button
                    key={g}
                    type={selectedGroup === g ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setSelectedGroup(g)}
                  >
                    Group {g}
                  </Button>
                ))}
                <Button 
                  size="small" 
                  danger
                  onClick={() => clearGroup(selectedGroup)}
                >
                  Clear Group
                </Button>
              </Space>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                borderCollapse: 'collapse', 
                width: '100%', 
                fontSize: 11,
                fontFamily: 'monospace'
              }}>
                <thead>
                  <tr>
                    <th style={{ 
                      padding: '4px 8px', 
                      textAlign: 'left', 
                      width: 80,
                      background: '#222'
                    }}>
                      Pad
                    </th>
                    {stepNumbers.map(step => (
                      <th 
                        key={step}
                        style={{ 
                          padding: '2px', 
                          textAlign: 'center', 
                          width: 28,
                          background: currentStep === step ? '#ff681d' : '#222',
                          color: currentStep === step ? 'white' : '#888',
                        }}
                      >
                        {step}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: PADS_PER_GROUP }, (_, i) => i + 1).map(pad => (
                    <tr key={pad}>
                      <td style={{ 
                        padding: '2px 4px', 
                        background: '#1a1a1a',
                        color: '#aaa'
                      }}>
                        {getPadName(selectedGroup, pad)}
                      </td>
                      {stepNumbers.map(step => {
                        const cell = grid[selectedGroup][pad]?.[step];
                        const isActive = cell?.active;
                        return (
                          <td 
                            key={step}
                            style={{ 
                              padding: 2, 
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                            onClick={() => togglePad(selectedGroup, pad, step)}
                          >
                            <div style={{
                              width: 20,
                              height: 20,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isActive 
                                ? `hsl(${cell?.velocity || 100}, 70%, 50%)`
                                : currentStep === step 
                                  ? '#333' 
                                  : '#1a1a1a',
                              border: currentStep === step 
                                ? '1px solid #ff681d' 
                                : '1px solid #333',
                              borderRadius: 3,
                              transition: 'background 0.1s',
                            }}>
                              {isActive && (
                                <AudioOutlined style={{ fontSize: 10, color: '#fff' }} />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Col>
        
        {/* Side Panel: Pad Details & Velocity */}
        <Col style={{ width: 280 }}>
          <Card size="small" title="Pad Selection" style={{ marginBottom: 16 }}>
            <Select
              style={{ width: '100%', marginBottom: 12 }}
              value={selectedGroup}
              onChange={setSelectedGroup}
              options={GROUPS.map(g => ({ value: g, label: `Group ${g}` }))}
            />
            <div style={{ fontSize: 11, color: '#888' }}>
              Click cells in the grid to toggle notes on/off
            </div>
          </Card>
          
          <Card size="small" title="Quick Actions">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                icon={<ClearOutlined />} 
                onClick={() => clearGroup(selectedGroup)}
              >
                Clear Group {selectedGroup}
              </Button>
              <Button 
                block 
                icon={<ExportOutlined />}
              >
                Export Pattern
              </Button>
            </Space>
          </Card>
          
          <Card size="small" title="Info" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6 }}>
              <div><strong>EP-133 Pattern Data:</strong></div>
              <div>• {numSteps} steps (16th notes)</div>
              <div>• {PADS_PER_GROUP} pads × {GROUPS.length} groups</div>
              <div>• Active notes: {countActiveSteps(selectedGroup)}</div>
              <Divider style={{ margin: '8px 0' }} />
              <div>Sequencer exports to P01.tar pattern files which are uploaded via restore.</div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default SequencerPage;
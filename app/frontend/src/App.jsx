import React, { useEffect } from 'react';
import { ConfigProvider, Layout, Menu, theme } from 'antd';
import {
  AppstoreOutlined,
  SoundOutlined,
  ExperimentOutlined,
  ImportOutlined,
  ExportOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import useStore from './store';
import LibraryPage from './pages/LibraryPage';
import SongBuilderPage from './pages/SongBuilderPage';
import PadEditorPage from './pages/PadEditorPage';
import ImportExportPage from './pages/ImportExportPage';

const { Sider, Content, Header } = Layout;

const NAV_ITEMS = [
  { key: 'library', icon: <SoundOutlined />, label: 'Sample Library' },
  { key: 'builder', icon: <AppstoreOutlined />, label: 'Song Builder' },
  { key: 'pads', icon: <ExperimentOutlined />, label: 'Pad Editor' },
  { key: 'import-export', icon: <ImportOutlined />, label: 'Import / Export' },
];

function App() {
  const { activePage, setActivePage, loadProjects, loadSampleSets } = useStore();

  useEffect(() => {
    loadProjects();
    loadSampleSets();
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'library': return <LibraryPage />;
      case 'builder': return <SongBuilderPage />;
      case 'pads': return <PadEditorPage />;
      case 'import-export': return <ImportExportPage />;
      default: return <LibraryPage />;
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#ff681d',
          colorBgBase: '#1a1a1a',
          colorBgContainer: '#222222',
          colorBgElevated: '#2a2a2a',
          colorBorder: '#3a3a3a',
          colorTextBase: '#e0e0e0',
          borderRadius: 4,
          fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
          fontSize: 12,
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        {/* Header */}
        <Header style={{
          background: '#111',
          borderBottom: '1px solid #333',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 48,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          {/* KO II Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              background: '#ff681d',
              color: 'white',
              fontWeight: 'bold',
              fontSize: 14,
              padding: '2px 8px',
              borderRadius: 3,
              letterSpacing: 1,
            }}>
              KO
            </div>
            <span style={{
              color: '#888',
              fontSize: 10,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}>
              KNOCKOUT
            </span>
            <span style={{
              color: '#555',
              fontSize: 9,
              marginLeft: 4,
            }}>
              K.O. II Workflow
            </span>
          </div>

          {/* Navigation */}
          <Menu
            mode="horizontal"
            selectedKeys={[activePage]}
            items={NAV_ITEMS}
            onClick={({ key }) => setActivePage(key)}
            style={{
              background: 'transparent',
              border: 'none',
              flex: 1,
              marginLeft: 24,
            }}
            theme="dark"
          />
        </Header>

        {/* Main Content */}
        <Content style={{
          background: '#151515',
          minHeight: 'calc(100vh - 48px)',
          overflow: 'auto',
        }}>
          {renderPage()}
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;

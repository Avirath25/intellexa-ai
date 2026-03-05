import { useState } from 'react';
import ConnectScreen from './components/ConnectScreen';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import VisualizationPanel from './components/VisualizationPanel';
import SchemaExplorer from './components/SchemaExplorer';
import QueryHistory from './components/QueryHistory';

export default function App() {
    const [connected, setConnected] = useState(false);
    const [schema, setSchema] = useState(null);
    const [activeView, setActiveView] = useState('dashboard');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [queryResult, setQueryResult] = useState(null);

    const handleConnect = (schemaData) => {
        setSchema(schemaData);
        setConnected(true);
    };

    const handleQueryResult = (result) => {
        setQueryResult(result);
        setActiveView('dashboard');
    };

    const handleDisconnect = async () => {
        try { await fetch('/api/disconnect', { method: 'POST' }); } catch { }
        setConnected(false);
        setSchema(null);
        setQueryResult(null);
        setActiveView('dashboard');
    };

    if (!connected) {
        return <ConnectScreen onConnect={handleConnect} />;
    }

    const renderMainContent = () => {
        switch (activeView) {
            case 'schema':
                return <SchemaExplorer schema={schema} />;
            case 'history':
                return <QueryHistory onReRun={handleQueryResult} />;
            case 'dashboard':
            default:
                return <VisualizationPanel queryResult={queryResult} />;
        }
    };

    return (
        <div className="app-layout">
            <Sidebar
                activeView={activeView}
                onViewChange={setActiveView}
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                schema={schema}
                onDisconnect={handleDisconnect}
            />
            <div className="main-content">
                <ChatPanel onQueryResult={handleQueryResult} />
                {renderMainContent()}
            </div>
        </div>
    );
}

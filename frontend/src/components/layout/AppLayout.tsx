import { useState } from 'react';
import { Box } from '@mui/material';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import ReviewPage from '../../pages/ReviewPage';
import RulesPage from '../../pages/RulesPage';
import LLMSettingsPage from '../../pages/LLMSettingsPage';
import ArchitecturePage from '../../pages/ArchitecturePage';
import CICDIntegrationPage from '../../pages/CICDIntegrationPage';
import ExistingWorkflowIntegrationPage from '../../pages/ExistingWorkflowIntegrationPage';
import EnterpriseCredentialsPage from '../../pages/EnterpriseCredentialsPage';
import DynamicRulesPage from '../../pages/DynamicRulesPage';
import ObservabilityPage from '../../pages/ObservabilityPage';

interface Props {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function AppLayout({ darkMode, onToggleDarkMode }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar
        aiStatus={aiStatus}
        progress={progress}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
      />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {activeTab === 0 && (
            <ReviewPage
              onAiStatusChange={setAiStatus}
              onProgressChange={setProgress}
            />
          )}
          {activeTab === 1 && <RulesPage />}
          {activeTab === 2 && <LLMSettingsPage />}
          {activeTab === 3 && <ArchitecturePage />}
          {activeTab === 4 && <CICDIntegrationPage />}
          {activeTab === 5 && <ExistingWorkflowIntegrationPage />}
          {activeTab === 6 && <EnterpriseCredentialsPage />}
          {activeTab === 7 && <DynamicRulesPage />}
          {activeTab === 8 && <ObservabilityPage />}
        </Box>
      </Box>
    </Box>
  );
}

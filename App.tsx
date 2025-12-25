
import React, { useEffect, useState } from 'react';
import { db } from './services/db';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { FoodLogger } from './components/FoodLogger';
import { FlareLogger } from './components/FlareLogger';
import { DailyTracker } from './components/DailyTracker';
import { Onboarding } from './components/Onboarding';
import { AICoach } from './components/AICoach';
import { Marketplace } from './components/Marketplace';
import { Settings } from './components/Settings';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const state = db.getState();
    if (state.user && state.user.onboardingCompleted) {
      setIsOnboarded(true);
    }
    setInitialized(true);
  }, []);

  if (!initialized) return null;

  if (!isOnboarded) {
    return <Onboarding onComplete={() => setIsOnboarded(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'food':
        return <FoodLogger />;
      case 'shop':
        return <Marketplace />;
      case 'coach':
        return <AICoach />;
      case 'flare':
        return <FlareLogger />;
      case 'daily':
        return <DailyTracker />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

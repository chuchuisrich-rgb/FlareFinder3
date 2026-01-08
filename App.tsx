
import React, { useEffect, useState } from 'react';
import { db } from './services/db';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Forecast } from './components/Forecast';
import { FoodLogger } from './components/FoodLogger';
import { FlareLogger } from './components/FlareLogger';
import { DailyTracker } from './components/DailyTracker';
import { Onboarding } from './components/Onboarding';
import { Marketplace } from './components/Marketplace';
import { Settings } from './components/Settings';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [forecastItems, setForecastItems] = useState<any[]>([]);

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
        return <Dashboard onNewForecast={(item: any) => {
          // prepend new forecast item
          setForecastItems(prev => [item, ...prev]);
          setActiveTab('forecast');
        }} />;
      case 'food':
        return <FoodLogger />;
      case 'forecast':
        return <Forecast items={forecastItems} />;
      case 'shop':
        return <Marketplace />;
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

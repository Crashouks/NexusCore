import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CloudProvider } from './context/CloudContext';
import { TrialProvider } from './context/TrialContext';
import { WishlistProvider } from './context/WishlistContext';
import { DownloadProvider } from './context/DownloadContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/Toast';
import Header from './components/Header';
import Footer from './components/Footer';
import CloudSessionBar from './components/CloudSessionBar';
import TrialBar from './components/TrialBar';
import ProtectedRoute from './components/ProtectedRoute';
import ShopPage from './pages/ShopPage';
import Store from './pages/Store';
import GameDetail from './pages/GameDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Library from './pages/Library';
import Community from './pages/Community';
import CloudPage from './pages/CloudPage';
import Wishlist from './pages/Wishlist';
import Downloads from './pages/Downloads';
import DeveloperPanel from './pages/DeveloperPanel';
import AdminPanel from './pages/AdminPanel';
import AccountSettings from './pages/AccountSettings';
import PurchaseHistory from './pages/PurchaseHistory';
import RedeemKey from './pages/RedeemKey';
import BuyModal from './components/BuyModal';
import { useTrial } from './context/TrialContext';

function TrialExpiredModal() {
  const { expiredGame, setExpiredGame } = useTrial();
  return (
    <BuyModal
      open={!!expiredGame}
      onClose={() => setExpiredGame(null)}
      game={expiredGame ? { ...expiredGame, game_id: expiredGame.game_id } : null}
      trialExpired
    />
  );
}

function AppContent() {
  return (
    <>
      <Header />
      <CloudSessionBar />
      <TrialBar />
      <TrialExpiredModal />
      <Routes>
        <Route path="/" element={<ShopPage />} />
        <Route path="/store" element={<Store />} />
        <Route path="/games/:slug" element={<GameDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
        <Route path="/library/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
        <Route path="/community" element={<Community />} />
        <Route path="/friends" element={<Navigate to="/community?tab=friends" replace />} />
        <Route path="/community/forums" element={<Navigate to="/community?tab=forums" replace />} />
        <Route path="/community/friends" element={<Navigate to="/community?tab=friends" replace />} />
        <Route path="/community/reviews" element={<Navigate to="/community?tab=forums" replace />} />
        <Route path="/community/events" element={<Navigate to="/community?tab=forums" replace />} />
        <Route path="/cloud" element={<ProtectedRoute><CloudPage /></ProtectedRoute>} />
        <Route path="/cart" element={<Navigate to="/store" replace />} />
        <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute><PurchaseHistory /></ProtectedRoute>} />
        <Route path="/redeem" element={<ProtectedRoute><RedeemKey /></ProtectedRoute>} />
        <Route path="/developer" element={<ProtectedRoute roles={['developer', 'admin']}><DeveloperPanel /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <WishlistProvider>
              <CloudProvider>
                <DownloadProvider>
                  <TrialProvider>
                    <AppContent />
                  </TrialProvider>
                </DownloadProvider>
              </CloudProvider>
            </WishlistProvider>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

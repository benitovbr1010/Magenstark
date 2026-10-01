import { Navigate, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { useAuth } from './lib/AuthContext'
import { BowelMovement } from './screens/BowelMovement'
import { DayClosing } from './screens/DayClosing'
import { Document } from './screens/Document'
import { Knowledge } from './screens/Knowledge'
import { Login } from './screens/Login'
import { Meal } from './screens/Meal'
import { MyWay } from './screens/MyWay'
import { Today } from './screens/Today'
import { Week } from './screens/Week'
import { Wellbeing } from './screens/Wellbeing'

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background pb-24">
      {children}
      <TabBar />
    </div>
  )
}

function CaptureLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-md bg-background">{children}</div>
}

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-background" />
  }

  if (!session) {
    return <Login />
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout><Today /></MainLayout>} />
      <Route path="/woche" element={<MainLayout><Week /></MainLayout>} />
      <Route path="/mein-weg" element={<MainLayout><MyWay /></MainLayout>} />
      <Route path="/toilette" element={<CaptureLayout><BowelMovement /></CaptureLayout>} />
      <Route path="/befinden" element={<CaptureLayout><Wellbeing /></CaptureLayout>} />
      <Route path="/mahlzeit" element={<CaptureLayout><Meal /></CaptureLayout>} />
      <Route path="/tagesabschluss" element={<CaptureLayout><DayClosing /></CaptureLayout>} />
      <Route path="/dokument" element={<CaptureLayout><Document /></CaptureLayout>} />
      <Route path="/wissen" element={<CaptureLayout><Knowledge /></CaptureLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

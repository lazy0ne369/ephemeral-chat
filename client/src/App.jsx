import '../src/styles/global.css';
import { useRoom } from './context/RoomContext';
import Landing from './components/Landing';
import Room from './components/Room';
import { RoomDeleted, Kicked } from './components/Screens';

export default function App() {
  const { roomStatus, resetRoom } = useRoom();

  if (roomStatus === 'deleted') return <RoomDeleted onReset={resetRoom} />;
  if (roomStatus === 'kicked') return <Kicked onReset={resetRoom} />;
  if (roomStatus === 'active') return <Room />;
  return <Landing />;
}

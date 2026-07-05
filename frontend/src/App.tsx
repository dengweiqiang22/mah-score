import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";

export function App() {
  const roomPathMatch = window.location.pathname.match(/^\/room\/(?<roomId>\d{3})$/u);
  const roomId = roomPathMatch?.groups?.roomId;

  if (roomId !== undefined) {
    return <RoomPage roomId={roomId} />;
  }

  return <HomePage />;
}

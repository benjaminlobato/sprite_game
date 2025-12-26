import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function Announcements() {
  const announcements = useGameStore(state => state.announcements);
  const clearOldAnnouncements = useGameStore(state => state.clearOldAnnouncements);

  // Clear old announcements periodically
  useEffect(() => {
    const interval = setInterval(() => {
      clearOldAnnouncements();
    }, 1000);

    return () => clearInterval(interval);
  }, [clearOldAnnouncements]);

  if (announcements.length === 0) return null;

  return (
    <div className="announcements">
      {announcements.map(announcement => (
        <div key={announcement.id} className="announcement">
          {announcement.message}
        </div>
      ))}
    </div>
  );
}

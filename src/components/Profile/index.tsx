import { useState, useEffect } from "react";
import type { UserInstance } from "../../models/user";
import AuthSession from "../../utils/session";
import "../profileCalendar.scss";

type ProfileCardProps = {
    profile: UserInstance;
};

const ProfileCard = ({ profile }: ProfileCardProps) => {
  const role = profile?.role ?? AuthSession.getRoles();
  const name = profile?.name ?? AuthSession.getName();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Placeholder for profile image - replace with actual image path
  const profileImageUrl = "/src/assets/images/oguzhan_karabacak.jfif";

  return (
    <div className="profile-section">
      <div className="profile-info">
        <div className="profile-info-img">
        <img 
          src={profileImageUrl} 
          alt="Profile" 
          className="profile-image"
          onError={(e) => {
            // Fallback to a default avatar if image fails to load
            (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Ccircle cx='30' cy='30' r='30' fill='%2319979c'/%3E%3Ctext x='30' y='38' font-size='24' fill='white' text-anchor='middle' font-family='Arial'%3E${profile?.name?.charAt(0) || 'U'}%3C/text%3E%3C/svg%3E`;
          }}
        />
        <p>{role?.name}</p>
        </div>
        <div className="profile-details">
          <h2>Welcome, {name}</h2>
          <p>{profile?.email ?? AuthSession.getEmail()}</p>
        </div>
      </div>
      <button 
        className="theme-toggle" 
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  );
};

export default ProfileCard;
/**
 * UserProfileContext
 *
 * Context for managing user profile modal state.
 * Allows any component to trigger viewing a user's profile.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { UserProfileModal } from "../components/Profile";

interface UserProfileContextType {
  openProfile: (userId: string) => void;
  closeProfile: () => void;
}

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
};

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openProfile = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setIsOpen(true);
  }, []);

  const closeProfile = useCallback(() => {
    setIsOpen(false);
    // Delay clearing userId to allow exit animation
    setTimeout(() => setSelectedUserId(null), 200);
  }, []);

  return (
    <UserProfileContext.Provider value={{ openProfile, closeProfile }}>
      {children}
      <UserProfileModal
        userId={selectedUserId}
        open={isOpen}
        onClose={closeProfile}
      />
    </UserProfileContext.Provider>
  );
};

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchCommunityMembersQuery } from '../features/membership/membershipApiSlice';
import { useGetMentionableChannelsQuery } from '../features/channel/channelApiSlice';
import { getCurrentMention } from '../utils/mentionParser';

export interface MentionSuggestion {
  id: string;
  type: 'user' | 'channel';
  displayName: string;
  subtitle?: string;
  avatar?: string;
}

export interface MentionAutocompleteState {
  isOpen: boolean;
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  query: string;
  type: 'user' | 'channel' | null;
  isLoading: boolean;
}

interface UseMentionAutocompleteProps {
  communityId: string;
  text: string;
  cursorPosition: number;
}

export function useMentionAutocomplete({
  communityId,
  text,
  cursorPosition,
}: UseMentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Get current mention being typed
  const currentMention = useMemo(() => {
    return getCurrentMention(text, cursorPosition);
  }, [text, cursorPosition]);

  // Search queries
  const {
    data: memberResults = [],
    isLoading: isLoadingMembers,
    isFetching: isFetchingMembers,
  } = useSearchCommunityMembersQuery(
    {
      communityId,
      query: currentMention?.query || '',
      limit: 10,
    },
    {
      skip: !currentMention || currentMention.type !== 'user' || currentMention.query.length === 0,
    }
  );

  const {
    data: channelResults = [],
    isLoading: isLoadingChannels,
    isFetching: isFetchingChannels,
  } = useGetMentionableChannelsQuery(communityId, {
    skip: !currentMention || currentMention.type !== 'channel',
  });

  // Process suggestions
  const suggestions = useMemo((): MentionSuggestion[] => {
    if (!currentMention) return [];

    if (currentMention.type === 'user') {
      return memberResults.map(member => ({
        id: member.user!.id,
        type: 'user' as const,
        displayName: member.user!.username,
        subtitle: member.user!.displayName || undefined,
        avatar: member.user!.avatarUrl || undefined,
      }));
    }

    if (currentMention.type === 'channel') {
      const query = currentMention.query.toLowerCase();
      return channelResults
        .filter(channel => 
          query === '' || channel.name.toLowerCase().includes(query)
        )
        .map(channel => ({
          id: channel.id,
          type: 'channel' as const,
          displayName: channel.name,
          subtitle: channel.description || undefined,
        }));
    }

    return [];
  }, [currentMention, memberResults, channelResults]);

  // Update open state based on suggestions
  useEffect(() => {
    const shouldOpen = currentMention !== null && 
                      currentMention.query.length >= 0 &&
                      suggestions.length > 0;
    
    if (shouldOpen !== isOpen) {
      setIsOpen(shouldOpen);
      if (shouldOpen) {
        setSelectedIndex(0);
      }
    }
  }, [currentMention, suggestions.length, isOpen]);

  // Reset selected index when suggestions change
  useEffect(() => {
    if (suggestions.length > 0 && selectedIndex >= suggestions.length) {
      setSelectedIndex(0);
    }
  }, [suggestions.length, selectedIndex]);

  // Loading state
  const isLoading = useMemo(() => {
    if (!currentMention) return false;
    
    if (currentMention.type === 'user') {
      return isLoadingMembers || isFetchingMembers;
    }
    
    if (currentMention.type === 'channel') {
      return isLoadingChannels || isFetchingChannels;
    }
    
    return false;
  }, [currentMention, isLoadingMembers, isFetchingMembers, isLoadingChannels, isFetchingChannels]);

  // Navigation functions
  const selectNext = useCallback(() => {
    if (suggestions.length === 0) return;
    setSelectedIndex(prev => (prev + 1) % suggestions.length);
  }, [suggestions.length]);

  const selectPrevious = useCallback(() => {
    if (suggestions.length === 0) return;
    setSelectedIndex(prev => prev === 0 ? suggestions.length - 1 : prev - 1);
  }, [suggestions.length]);

  const selectSuggestion = useCallback((index: number) => {
    if (index >= 0 && index < suggestions.length) {
      setSelectedIndex(index);
    }
  }, [suggestions.length]);

  const getSelectedSuggestion = useCallback(() => {
    return suggestions[selectedIndex] || null;
  }, [suggestions, selectedIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(0);
  }, []);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent): boolean => {
    if (!isOpen || suggestions.length === 0) return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectNext();
        return true;

      case 'ArrowUp':
        event.preventDefault();
        selectPrevious();
        return true;

      case 'Enter':
      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          event.preventDefault();
          return true; // Let parent handle the actual insertion
        }
        return false;

      case 'Escape':
        event.preventDefault();
        close();
        return true;

      default:
        return false;
    }
  }, [isOpen, suggestions.length, selectedIndex, selectNext, selectPrevious, close]);

  const state: MentionAutocompleteState = {
    isOpen,
    suggestions,
    selectedIndex,
    query: currentMention?.query || '',
    type: currentMention?.type || null,
    isLoading,
  };

  return {
    state,
    currentMention,
    selectNext,
    selectPrevious,
    selectSuggestion,
    getSelectedSuggestion,
    close,
    handleKeyDown,
  };
}
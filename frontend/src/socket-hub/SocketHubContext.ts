import { createContext } from 'react';
import type { EventBus } from './emitter';

export const SocketHubContext = createContext<EventBus | null>(null);

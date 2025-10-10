import { InjectionToken, WritableSignal } from '@angular/core';

export interface ServerContext {
  id: string;
  name: string;
  icon?: string | null;
}

export const SERVER_CONTEXT_PROVIDER = new InjectionToken<WritableSignal<ServerContext>>('ServerContextProvider');

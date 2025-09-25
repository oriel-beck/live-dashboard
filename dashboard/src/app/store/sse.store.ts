import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { injectParams } from 'ngxtension/inject-params';
import { environment } from '../../environments/environment';
import { computed, inject } from '@angular/core';
import { pipe, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import {
  GuildRole,
  GuildChannel,
  GuildInfo,
  CommandCategory,
  CommandConfigResult,
  CommandConfigResultWithCategory,
  GuildApplicationCommandPermissions,
} from '@discord-bot/shared-types';

interface CacheStore {
  source: EventSource | null;
  guildId: string | null;
  lastEvent: string | null;
  retryCount: number;
  commands: Map<number, CommandConfigResultWithCategory>;
  commandPermissions: Map<string, GuildApplicationCommandPermissions>;
  roles: GuildRole[];
  channels: GuildChannel[];
  isLoading: boolean;
  error: string | null;
  guildInfo: GuildInfo | null;
}

const initialState: CacheStore = {
  source: null,
  guildId: null,
  lastEvent: null,
  retryCount: 0,
  commands: new Map<number, CommandConfigResultWithCategory>(),
  commandPermissions: new Map<string, GuildApplicationCommandPermissions>(),
  roles: [],
  channels: [],
  isLoading: true,
  error: null,
  guildInfo: null,
};

export const CacheStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const router = inject(Router);
    const obj = {
      retryConnection: () => {
        if (store.retryCount() === 5) {
          console.error('[SSE] Max retry attempts reached, giving up');
          store.source()?.close();
          patchState(store, {
            error: 'Max retry attempts reached',
          });
          return;
        }

        console.log(`[SSE] Retrying connection (attempt ${store.retryCount() + 1}/5)`);
        
        if (store.source()) {
          store.source()?.close();
        }

        // Add delay between retries to prevent overwhelming the server
        const delay = Math.min(1000 * Math.pow(2, store.retryCount()), 10000); // Exponential backoff, max 10s
        setTimeout(() => {
          obj.createSource();
        }, delay);

        patchState(store, {
          retryCount: store.retryCount() + 1,
        });
      },
      createSource: () => {
        // Close existing connection if any
        if (store.source()) {
          console.log('[SSE] Closing existing connection before creating new one');
          store.source()?.close();
        }

        console.log(`[SSE] Creating new connection to ${environment.apiUrl}/guilds/${store.guildId()}/events`);
        const source = new EventSource(
          `${environment.apiUrl}/guilds/${store.guildId()}/events`,
          {
            withCredentials: true,
          }
        );

        source.addEventListener('open', () => {
          patchState(store, {
            lastEvent: 'Connected',
            retryCount: 0,
          });
        });

        // Handle all events with a single listener and switch statement
        source.addEventListener('message', (evt: MessageEvent) => {
          try {
            const event = JSON.parse(evt.data);
            console.log('[DEBUG] SSE event received:', event);

            switch (event.type) {
              case 'guild_info_loaded':
                patchState(store, {
                  lastEvent: 'guild_info_loaded',
                  guildInfo: event.guildInfo,
                  isLoading: false,
                });
                break;

              case 'roles_loaded':
                patchState(store, {
                  lastEvent: 'roles_loaded',
                  roles: event.roles,
                });
                break;

              case 'channels_loaded':
                patchState(store, {
                  lastEvent: 'channels_loaded',
                  channels: event.channels,
                });
                break;

              case 'commands_loaded':
                patchState(store, {
                  lastEvent: 'commands_loaded',
                  commands: (
                    event.commands as CommandConfigResultWithCategory[]
                  ).reduce((acc, command) => {
                    acc.set(command.id, command);
                    return acc;
                  }, new Map<number, CommandConfigResultWithCategory>()),
                });
                break;

              case 'command_permissions_loaded':
                patchState(store, {
                  lastEvent: 'command_permissions_loaded',
                  commandPermissions: (
                    event.commandPermissions as GuildApplicationCommandPermissions[]
                  ).reduce((acc, permission) => {
                    acc.set(permission.id, permission);
                    return acc;
                  }, new Map<string, GuildApplicationCommandPermissions>()),
                });
                break;

              case 'initial':
                // Legacy support for initial event
                patchState(store, {
                  lastEvent: 'initial',
                  guildInfo: event.guildInfo,
                  roles: event.roles,
                  channels: event.channels,
                  commands: (
                    event.commands as CommandConfigResultWithCategory[]
                  ).reduce((acc, command) => {
                    acc.set(command.id, command);
                    return acc;
                  }, new Map<number, CommandConfigResultWithCategory>()),
                  commandPermissions: (
                    event.commandPermissions as GuildApplicationCommandPermissions[]
                  ).reduce((acc, permission) => {
                    acc.set(permission.id, permission);
                    return acc;
                  }, new Map<string, GuildApplicationCommandPermissions>()),
                  isLoading: false,
                });
                break;

              default:
                if (event.error) {
                  console.error('[Dashboard] SSE error:', event.error);
                } else {
                  console.warn('[Dashboard] Unknown SSE event type:', event.type);
                }
                break;
            }
          } catch (error) {
            console.error('[Dashboard] Error processing SSE event:', error);
          }
        });


        source.addEventListener('update', (evt: MessageEvent) => {
          try {
            patchState(store, {
              lastEvent: evt.data,
            });
            const event = JSON.parse(evt.data);

            switch (event.type) {
              case 'guild_fetch_failed':
                console.error(
                  `[Dashboard] Guild fetch failed for ${event.guildId}:`,
                  event.error
                );
                patchState(store, {
                  error: `Failed to load guild data: ${event.error}`,
                });
                store.source()?.close();
                router.navigate(['/servers']);
                break;
              case 'channel.create':
                patchState(store, {
                  channels: [...store.channels(), event.data],
                });
                break;
              case 'channel.update':
                patchState(store, {
                  channels: store
                    .channels()
                    .map((channel) =>
                      channel.id === event.channelId ? event.data : channel
                    ),
                });
                break;
              case 'channel.delete':
                patchState(store, {
                  channels: store
                    .channels()
                    .filter((channel) => channel.id !== event.channelId),
                });
                break;
              case 'role.create':
                patchState(store, {
                  roles: [...store.roles(), event.data],
                });
                break;
              case 'role.update':
                patchState(store, {
                  roles: store
                    .roles()
                    .map((role) =>
                      role.id === event.roleId ? event.data : role
                    ),
                });
                break;
              case 'role.delete':
                patchState(store, {
                  roles: store
                    .roles()
                    .filter((role) => role.id !== event.roleId),
                });
                break;
              case 'guild.update':
                patchState(store, {
                  guildInfo: event.data,
                });
                break;
              case 'command.permissions.update':
                const copyPermissions = new Map(store.commandPermissions());
                const data = copyPermissions.get(event.commandId);
                if (data) {
                  data.permissions = event.permissions;
                  patchState(store, {
                    commandPermissions: copyPermissions,
                  });
                }
                break;
            }
          } catch {
            /* ignore malformed */
          }
        });

        source.addEventListener('error', (event) => {
          console.error('[SSE] Connection error:', event);
          
          // Check if the connection was closed by the server or client
          const readyState = source.readyState;
          let errorMessage = 'SSE connection failed';
          
          if (readyState === EventSource.CLOSED) {
            errorMessage = 'SSE connection closed by server';
          } else if (readyState === EventSource.CONNECTING) {
            errorMessage = 'SSE connection failed to establish';
          }
          
          patchState(store, {
            lastEvent: 'Error',
            error: errorMessage,
          });
          
          // Only retry if we haven't exceeded max retries
          if (store.retryCount() < 5) {
            obj.retryConnection();
          }
        });

        patchState(store, {
          source,
        });
      },
    };
    return obj;
  }),
  withMethods((store) => {
    const obj = {};
    return obj;
  }),
  withComputed((store) => {
    return {
      commandsCategories: computed(() => {
        return Array.from(store.commands().values()).reduce(
          (acc, command: CommandConfigResultWithCategory) => {
            // Check if command has category information
            if (command.categoryId && command.category) {
              let data = acc.get(command.categoryId) ?? command.category;
              data.commands ??= [];
              const existingCommand = data.commands.find(
                (c: CommandConfigResult) => c.id === command.id
              );
              if (!existingCommand) {
                data.commands.push(command);
              } else {
                data.commands = data.commands.map((c: CommandConfigResult) =>
                  c.id === command.id ? command : c
                );
              }
              acc.set(command.categoryId, data);
            }
            return acc;
          },
          new Map<number, CommandCategory>()
        );
      }),
      // Computed properties to track what data has been loaded
      isGuildInfoLoaded: computed(() => !!store.guildInfo()),
      isRolesLoaded: computed(() => {
        const lastEvent = store.lastEvent();
        return lastEvent?.includes('roles_loaded') || lastEvent?.includes('initial');
      }),
      isChannelsLoaded: computed(() => {
        const lastEvent = store.lastEvent();
        return lastEvent?.includes('channels_loaded') || lastEvent?.includes('initial');
      }),
      isCommandsLoaded: computed(() => store.commands().size > 0),
      isCommandPermissionsLoaded: computed(() => store.commandPermissions().size > 0),
      
      // Progressive loading computed properties
      isBasicDataLoaded: computed(() => {
        // Basic data is loaded when we have guild info (the most critical piece)
        return !!store.guildInfo();
      }),
      isCommandsLoading: computed(() => {
        // Commands are loading if we have basic data but no commands yet and we're connected
        const hasBasicData = !!store.guildInfo();
        const hasCommands = store.commands().size > 0;
        const isConnected = !!store.lastEvent() && store.lastEvent() !== 'Error';
        return hasBasicData && !hasCommands && isConnected && !store.error();
      }),
      isCommandConfigLoading: computed(() => {
        // Command config buttons are loading until we have roles and channels
        const hasCommands = store.commands().size > 0;
        const rolesLoaded = store.roles();
        const channelsLoaded = store.channels();
        
        return hasCommands && (!rolesLoaded || !channelsLoaded);
      }),
      isFullyLoaded: computed(() => {
        // Fully loaded when we have guild info and commands
        return !!store.guildInfo() && store.commands().size > 0;
      }),
    };
  }),
  withHooks((store) => {
    const params = injectParams();
    const guildId = params()['serverId'];
    return {
      onInit: () => {
        patchState(store, {
          guildId,
        });
        store.createSource();
      },
      onDestroy: () => {
        store.source()?.close();
      },
    };
  })
);

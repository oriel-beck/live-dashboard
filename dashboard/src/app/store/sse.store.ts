import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BotProfile,
  CommandCategory,
  CommandConfigResult,
  CommandConfigResultWithCategory,
  GuildApplicationCommandPermissions,
  GuildChannel,
  GuildInfo,
  GuildRole,
  SSEEvent,
  SSE_EVENT_TYPES,
} from '@discord-bot/shared-types';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { injectParams } from 'ngxtension/inject-params';
import { environment } from '../../environments/environment';

interface CacheStore {
  source: EventSource | null;
  guildId: string | null;
  retryCount: number;
  commands: Map<number, CommandConfigResultWithCategory>;
  commandPermissions: Map<string, GuildApplicationCommandPermissions>;
  roles: GuildRole[];
  channels: GuildChannel[];
  error: string | null;
  guildInfo: GuildInfo | null;
  botProfile: BotProfile | null;
  globalBotProfile: BotProfile | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

const initialState: CacheStore = {
  source: null,
  guildId: null,
  retryCount: 0,
  commands: new Map<number, CommandConfigResultWithCategory>(),
  commandPermissions: new Map<string, GuildApplicationCommandPermissions>(),
  roles: [],
  channels: [],
  error: null,
  guildInfo: null,
  botProfile: null,
  globalBotProfile: null,
  connectionStatus: 'disconnected',
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

        console.log(
          `[SSE] Retrying connection (attempt ${store.retryCount() + 1}/5)`
        );

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
          console.log(
            '[SSE] Closing existing connection before creating new one'
          );
          store.source()?.close();
        }

        console.log(
          `[SSE] Creating new connection to ${
            environment.apiUrl
          }/guilds/${store.guildId()}/events`
        );
        const source = new EventSource(
          `${environment.apiUrl}/guilds/${store.guildId()}/events`,
          {
            withCredentials: true,
          }
        );

        source.addEventListener('open', () => {
          console.log('[SSE] Connection opened');
          patchState(store, {
            retryCount: 0,
            connectionStatus: 'connected',
            error: null,
          });
        });

        // Handle all events with a single listener and type-safe switch statement
        source.addEventListener('message', (evt: MessageEvent) => {
          try {
            const event = JSON.parse(evt.data) as SSEEvent;
            console.log('[DEBUG] SSE event received:', event);

            switch (event.type) {
              case SSE_EVENT_TYPES.GUILD_INFO_LOADED:
                patchState(store, {
                  guildInfo: event.data,
                });
                break;

              case SSE_EVENT_TYPES.GUILD_INFO_FAILED:
                console.error('[Dashboard] Guild info failed:', event.data);
                patchState(store, {
                  error: `Failed to load guild info: ${event.data}`,
                });
                break;

              case SSE_EVENT_TYPES.ROLES_LOADED:
                patchState(store, {
                  roles: event.data,
                });
                break;

              case SSE_EVENT_TYPES.ROLES_FAILED:
                console.error('[Dashboard] Roles failed:', event.data);
                patchState(store, {
                  error: `Failed to load roles: ${event.data}`,
                });
                break;

              case SSE_EVENT_TYPES.CHANNELS_LOADED:
                patchState(store, {
                  channels: event.data,
                });
                break;

              case SSE_EVENT_TYPES.CHANNELS_FAILED:
                console.error('[Dashboard] Channels failed:', event.data);
                patchState(store, {
                  error: `Failed to load channels: ${event.data}`,
                });
                break;

              case SSE_EVENT_TYPES.COMMANDS_LOADED:
                patchState(store, {
                  commands: event.data.reduce((acc, command) => {
                    acc.set(command.id, command);
                    return acc;
                  }, new Map<number, CommandConfigResultWithCategory>()),
                });
                break;

              case SSE_EVENT_TYPES.COMMANDS_FAILED:
                console.error('[Dashboard] Commands failed:', event.data);
                patchState(store, {
                  error: `Failed to load commands: ${event.data}`,
                });
                break;

              case SSE_EVENT_TYPES.COMMAND_PERMISSIONS_LOADED:
                patchState(store, {
                  commandPermissions: event.data.reduce(
                    (
                      acc: Map<string, GuildApplicationCommandPermissions>,
                      permission: GuildApplicationCommandPermissions
                    ) => {
                      acc.set(permission.id, permission);
                      return acc;
                    },
                    new Map<string, GuildApplicationCommandPermissions>()
                  ),
                });
                break;

              case SSE_EVENT_TYPES.COMMAND_PERMISSIONS_FAILED:
                console.error(
                  '[Dashboard] Command permissions failed:',
                  event.data
                );
                patchState(store, {
                  error: `Failed to load command permissions: ${event.data}`,
                });
                break;

              case SSE_EVENT_TYPES.BOT_PROFILE_LOADED:
                patchState(store, {
                  botProfile: event.data.guildProfile,
                  globalBotProfile: event.data.globalProfile,
                });
                break;

              case SSE_EVENT_TYPES.BOT_PROFILE_FAILED:
                console.error('[Dashboard] Bot profile failed:', event.data);
                patchState(store, {
                  error: `Failed to load bot profile: ${event.data}`,
                });
                break;

              case SSE_EVENT_TYPES.GUILD_FETCH_FAILED:
                console.error(
                  `[Dashboard] Guild fetch failed for ${event.data.guildId}:`,
                  event.data.error
                );
                patchState(store, {
                  error: `Failed to load guild data: ${event.data.error}`,
                });
                store.source()?.close();
                router.navigate(['/servers']);
                break;

              case SSE_EVENT_TYPES.GUILD_UPDATE:
                patchState(store, {
                  guildInfo: event.data,
                });
                break;

              case SSE_EVENT_TYPES.GUILD_DELETE:
                // Redirect to servers page if the deleted guild is the current guild
                // The deleted is always the current guild since the SSE event is only sent when the user is viewing the guild
                console.log(
                  `[Dashboard] Guild ${event.guildId} was deleted, redirecting to servers page`
                );
                store.source()?.close();
                router.navigate(['/servers']);
                break;

              case SSE_EVENT_TYPES.CHANNEL_CREATE:
                patchState(store, {
                  channels: [...store.channels(), event.data],
                });
                break;

              case SSE_EVENT_TYPES.CHANNEL_UPDATE:
                patchState(store, {
                  channels: store
                    .channels()
                    .map((channel) =>
                      channel.id === event.channelId ? event.data : channel
                    ),
                });
                break;

              case SSE_EVENT_TYPES.CHANNEL_DELETE:
                patchState(store, {
                  channels: store
                    .channels()
                    .filter((channel) => channel.id !== event.channelId),
                });
                break;

              case SSE_EVENT_TYPES.ROLE_CREATE:
                patchState(store, {
                  roles: [...store.roles(), event.data],
                });
                break;

              case SSE_EVENT_TYPES.ROLE_UPDATE:
                patchState(store, {
                  roles: store
                    .roles()
                    .map((role) =>
                      role.id === event.roleId ? event.data : role
                    ),
                });
                break;

              case SSE_EVENT_TYPES.ROLE_DELETE:
                patchState(store, {
                  roles: store
                    .roles()
                    .filter((role) => role.id !== event.roleId),
                });
                break;

              case SSE_EVENT_TYPES.COMMAND_PERMISSIONS_UPDATE:
                const copyPermissions = new Map(store.commandPermissions());
                const data = copyPermissions.get(event.commandId);
                if (data) {
                  data.permissions = event.permissions;
                  patchState(store, {
                    commandPermissions: copyPermissions,
                  });
                }
                break;

              case SSE_EVENT_TYPES.MEMBER_PERMS_UPDATE:
                // This event is for user-specific permissions, not guild-wide
                // We don't need to update the store for this event
                console.log(
                  `[Dashboard] Member permissions updated for guild ${event.guildId}`
                );
                break;

              case SSE_EVENT_TYPES.BOT_PROFILE_UPDATE:
                patchState(store, {
                  botProfile: event.data,
                });
                break;

              default:
                // Handle unknown events - this should never happen with proper typing
                const unknownEvent = event as any;
                if (unknownEvent.error) {
                  console.error('[Dashboard] SSE error:', unknownEvent.error);
                } else {
                  console.warn(
                    '[Dashboard] Unknown SSE event type:',
                    unknownEvent.type
                  );
                }
                break;
            }
          } catch (error) {
            console.error('[Dashboard] Error processing SSE event:', error);
          }
        });

        source.addEventListener('error', (event) => {
          console.error('[SSE] Connection error:', event);

          // Check if the connection was closed by the server or client
          const readyState = source.readyState;
          let errorMessage = 'SSE connection failed';
          let connectionStatus: 'connecting' | 'error' = 'error';

          if (readyState === EventSource.CLOSED) {
            errorMessage = 'SSE connection closed by server';
            connectionStatus = 'error';
          } else if (readyState === EventSource.CONNECTING) {
            errorMessage = 'SSE connection failed to establish';
            connectionStatus = 'connecting';
          }

          patchState(store, {
            error: errorMessage,
            connectionStatus,
          });

          // Only retry if we haven't exceeded max retries
          if (store.retryCount() < 5) {
            obj.retryConnection();
          }
        });

        patchState(store, {
          source,
          connectionStatus: 'connecting',
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
        return Array.from(store.commands().values()).reduce((acc, command) => {
          // Check if command has category information
          if (command.categoryId && command.category) {
            let data = acc.get(command.categoryId) ?? { ...command.category };
            // Ensure commands array exists
            if (!data.commands) {
              data.commands = [];
            }
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
        }, new Map<number, CommandCategory>());
      }),
      // The 4 main loading states for the entire application

      // 1. isLoading - guild data loading (entire page)
      isLoading: computed(() => {
        return !store.guildInfo();
      }),

      // 2. isCommandsLoading - commands loading (navigation to commands is loading)
      isCommandsLoading: computed(() => {
        return store.commands().size === 0;
      }),

      // 3. isCommandsConfigLoading - channels & roles are loading (commands cards configure button is loading)
      isCommandsConfigLoading: computed(() => {
        return store.roles().length === 0 || store.channels().length === 0;
      }),

      // 4. isBotLoading - bot data is loading
      isBotLoading: computed(() => {
        return !store.botProfile();
      }),

      // Connection status computed properties
      isConnected: computed(() => {
        return store.connectionStatus() === 'connected';
      }),
      isConnecting: computed(() => {
        return store.connectionStatus() === 'connecting';
      }),
      isDisconnected: computed(() => {
        return store.connectionStatus() === 'disconnected';
      }),
      hasConnectionError: computed(() => {
        return store.connectionStatus() === 'error';
      }),
      connectionStatusText: computed(() => {
        const status = store.connectionStatus();
        const error = store.error();

        switch (status) {
          case 'connected':
            return 'Live';
          case 'connecting':
            return 'Connecting...';
          case 'error':
            return error ? `Error: ${error}` : 'Connection Error';
          case 'disconnected':
            return 'Disconnected';
          default:
            return 'Unknown Status';
        }
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

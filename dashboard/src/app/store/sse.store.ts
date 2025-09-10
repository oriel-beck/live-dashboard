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
  isLoading: false,
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
          store.source()?.close();
          return;
        }

        if (store.source()) {
          store.source()?.close();
        }

        obj.createSource();

        patchState(store, {
          retryCount: store.retryCount() + 1,
        });
      },
      createSource: () => {
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

        source.addEventListener('initial', (evt: MessageEvent) => {
          try {
            patchState(store, {
              lastEvent: 'initial',
            });
            const event = JSON.parse(evt.data);
            
            console.log('[DEBUG] Initial event data:', event);
            
            patchState(store, {
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
            });
          } catch (error) {
            console.error('[Dashboard] Error processing initial event:', error);
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

        source.addEventListener('error', () => {
          patchState(store, {
            lastEvent: 'Error',
          });
          obj.retryConnection();
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
